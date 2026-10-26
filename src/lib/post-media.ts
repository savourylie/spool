import type { ThreadsPost, ThreadsPostMedia } from "@/lib/threads-api.types";
import type { ThreadsAPI } from "@/lib/threads-api";
import { THREADS_API_LAUNCH } from "@/lib/threads-api";
import { resolveLinkPreview } from "@/lib/link-preview";
import { normalizeThreadsMediaType } from "@/lib/post-media-type";
import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

const MEDIA_REFRESH_CUTOFF_DAYS = 3;
const MEDIA_REFRESH_LIMIT = 60;
const LINK_ENRICH_LIMIT = 80;
const LINK_ENRICH_CONCURRENCY = 6;
const CONTENT_SEED_BATCH_SIZE = 100;

type SupabaseClient = ReturnType<typeof createAdminClient>;

type ThreadsRef = { id: string } | string | null | undefined;

export function getThreadsRefId(ref: ThreadsRef): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return ref.id ?? null;
}

export function isRepostFacade(post: ThreadsPost): boolean {
  return post.media_type === "REPOST_FACADE";
}

function toChildrenJson(children: ThreadsPost["children"]): Json {
  if (!children) return null;
  return children as unknown as Json;
}

/**
 * Media fields taken from the list response. Threads signs its CDN URLs, so
 * `media_fetched_at` records when the URL was issued and drives refreshes.
 */
export function toPostContentFields(post: ThreadsPost, fetchedAt: string) {
  return {
    media_url: post.media_url ?? null,
    thumbnail_url: post.thumbnail_url ?? null,
    alt_text: post.alt_text ?? null,
    link_attachment_url: post.link_attachment_url ?? null,
    children: toChildrenJson(post.children),
    media_product_type: post.media_product_type ?? null,
    is_quote_post: post.is_quote_post ?? false,
    quoted_post_id: getThreadsRefId(post.quoted_post),
    gif_url: post.gif_url ?? null,
    media_fetched_at: fetchedAt,
  };
}

export function toMediaRefreshFields(
  media: ThreadsPostMedia,
  fetchedAt: string,
) {
  return {
    media_url: media.media_url ?? null,
    thumbnail_url: media.thumbnail_url ?? null,
    alt_text: media.alt_text ?? null,
    gif_url: media.gif_url ?? null,
    children: toChildrenJson(media.children),
    media_fetched_at: fetchedAt,
  };
}

export function toRepostRow(userId: string, post: ThreadsPost) {
  return {
    user_id: userId,
    threads_media_id: post.id,
    permalink: post.permalink ?? null,
    shortcode: post.shortcode ?? null,
    reposted_at: post.timestamp,
  };
}

export async function saveReposts(
  supabase: SupabaseClient,
  userId: string,
  posts: ThreadsPost[],
): Promise<number> {
  const rows = [
    ...new Map(
      posts
        .filter(isRepostFacade)
        .map((post) => [post.id, toRepostRow(userId, post)]),
    ).values(),
  ];

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("reposts")
    .upsert(rows, { onConflict: "threads_media_id" });

  if (error) throw error;
  return rows.length;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Backfills media and link fields for posts that were ingested before those
 * columns existed. This is a bounded, batched upsert over the full thread list.
 */
export async function updatePostContentFromThreads(
  supabase: SupabaseClient,
  userId: string,
  posts: ThreadsPost[],
): Promise<number> {
  const fetchedAt = new Date().toISOString();
  const rows: Array<{
    user_id: string;
    threads_media_id: string;
    media_type: string;
    text_preview: string | null;
    text_full: string | null;
    permalink: string;
    published_at: string;
    media_fetched_at: string;
  }> = [];

  for (const post of posts) {
    if (isRepostFacade(post)) continue;

    let mediaType: string;
    try {
      mediaType = normalizeThreadsMediaType(post.media_type);
    } catch {
      continue;
    }

    rows.push({
      user_id: userId,
      threads_media_id: post.id,
      media_type: mediaType,
      text_preview: post.text?.substring(0, 280) ?? null,
      text_full: post.text ?? null,
      permalink: post.permalink ?? null,
      published_at: post.timestamp,
      ...toPostContentFields(post, fetchedAt),
    });
  }

  const uniqueRows = [
    ...new Map(rows.map((row) => [row.threads_media_id, row])).values(),
  ];

  for (const batch of chunk(uniqueRows, CONTENT_SEED_BATCH_SIZE)) {
    const { error } = await supabase
      .from("posts")
      .upsert(batch, { onConflict: "threads_media_id" });
    if (error) throw error;
  }

  return uniqueRows.length;
}

/**
 * One-time full-list seed for installs created before media previews and repost
 * history existed. New installs get the same data from the backfill instead.
 */
export async function seedLibraryIfNeeded(
  supabase: SupabaseClient,
  userId: string,
  api: ThreadsAPI,
): Promise<{ reposts: number; posts: number }> {
  const { data: user, error } = await supabase
    .from("users")
    .select("reposts_seeded_at, post_content_seeded_at")
    .eq("id", userId)
    .single();

  if (error) throw error;

  const needsReposts = !user?.reposts_seeded_at;
  const needsContent = !user?.post_content_seeded_at;

  if (!needsReposts && !needsContent) {
    return { reposts: 0, posts: 0 };
  }

  const threads = await api.getUserPosts(THREADS_API_LAUNCH, {
    includeReposts: true,
  });

  const reposts = needsReposts
    ? await saveReposts(supabase, userId, threads)
    : 0;
  const posts = needsContent
    ? await updatePostContentFromThreads(supabase, userId, threads)
    : 0;

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("users")
    .update({
      ...(needsReposts ? { reposts_seeded_at: now } : {}),
      ...(needsContent ? { post_content_seeded_at: now } : {}),
    })
    .eq("id", userId);

  if (updateError) throw updateError;
  return { reposts, posts };
}

/**
 * Threads media URLs expire after a few days. Refresh a bounded batch on each
 * sync so previews keep working without downloading media into our own storage.
 */
export async function refreshStalePostMedia(
  supabase: SupabaseClient,
  userId: string,
  api: ThreadsAPI,
): Promise<number> {
  const cutoff = new Date(
    Date.now() - MEDIA_REFRESH_CUTOFF_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("posts")
    .select("id, threads_media_id, media_type, media_fetched_at, published_at")
    .eq("user_id", userId)
    .in("media_type", ["IMAGE", "VIDEO", "CAROUSEL"])
    .or(`media_fetched_at.is.null,media_fetched_at.lt.${cutoff}`)
    .order("published_at", { ascending: false })
    .limit(MEDIA_REFRESH_LIMIT);

  if (error) throw error;

  let refreshed = 0;

  for (const post of data ?? []) {
    try {
      const media = await api.getPostMedia(post.threads_media_id);
      const { error: updateError } = await supabase
        .from("posts")
        .update(toMediaRefreshFields(media, new Date().toISOString()))
        .eq("id", post.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;
      refreshed += 1;
    } catch (mediaError) {
      console.warn("Failed to refresh post media", {
        userId,
        postId: post.id,
        error: mediaError,
      });
    }
  }

  return refreshed;
}

/**
 * Fills link card metadata for posts that have an attachment but no resolved
 * site name yet. YouTube titles come from oEmbed; other links use the domain.
 */
export async function enrichMissingLinkPreviews(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, link_attachment_url")
    .eq("user_id", userId)
    .not("link_attachment_url", "is", null)
    .is("link_site_name", null)
    .order("published_at", { ascending: false })
    .limit(LINK_ENRICH_LIMIT);

  if (error) throw error;

  const rows = data ?? [];
  const resolved: Array<{
    id: string;
    title: string | null;
    siteName: string | null;
  }> = [];
  let cursor = 0;

  async function worker() {
    while (cursor < rows.length) {
      const post = rows[cursor];
      cursor += 1;
      if (!post.link_attachment_url) continue;

      const preview = await resolveLinkPreview(post.link_attachment_url);
      if (preview) {
        resolved.push({
          id: post.id,
          title: preview.title,
          siteName: preview.siteName,
        });
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(LINK_ENRICH_CONCURRENCY, rows.length) },
      () => worker(),
    ),
  );

  let enriched = 0;

  for (const preview of resolved) {
    const { error: updateError } = await supabase
      .from("posts")
      .update({
        link_title: preview.title,
        link_site_name: preview.siteName,
      })
      .eq("id", preview.id)
      .eq("user_id", userId);

    if (updateError) {
      console.warn("Failed to store link preview", {
        userId,
        postId: preview.id,
        error: updateError,
      });
      continue;
    }

    enriched += 1;
  }

  return enriched;
}
