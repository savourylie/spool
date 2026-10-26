import { type NextRequest, NextResponse } from "next/server";

import { decrypt } from "@/lib/crypto";
import { toMediaRefreshFields } from "@/lib/post-media";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { ThreadsAPI } from "@/lib/threads-api";
import type { ThreadsPostMedia } from "@/lib/threads-api.types";

const MAX_CAROUSEL_ITEMS = 10;

interface CarouselItem {
  id: string;
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  alt_text: string | null;
}

function getChildIds(media: ThreadsPostMedia): string[] {
  return (media.children?.data ?? [])
    .map((child) => child.id)
    .filter((id): id is string => typeof id === "string")
    .slice(0, MAX_CAROUSEL_ITEMS);
}

/**
 * Refreshes a post's signed Threads CDN URLs when the browser reports a broken
 * preview. For carousels it also resolves each child so the detail pane can
 * render the full set instead of only the cover.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await params;
  const supabase = createAdminClient();

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, threads_media_id, media_type")
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (postError || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("threads_user_id, access_token")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const api = new ThreadsAPI(decrypt(user.access_token), user.threads_user_id);
    const media = await api.getPostMedia(post.threads_media_id);

    const carousel: CarouselItem[] = [];

    if (post.media_type === "CAROUSEL") {
      for (const childId of getChildIds(media)) {
        try {
          const child = await api.getPostMedia(childId);
          carousel.push({
            id: child.id,
            media_type: child.media_type,
            media_url: child.media_url ?? null,
            thumbnail_url: child.thumbnail_url ?? null,
            alt_text: child.alt_text ?? null,
          });
        } catch (childError) {
          console.warn("Failed to refresh carousel item", {
            postId,
            childId,
            error: childError,
          });
        }
      }
    }

    const children =
      carousel.length > 0
        ? {
            data: carousel.map((item) => ({
              id: item.id,
              media_type: item.media_type,
              media_url: item.media_url,
              thumbnail_url: item.thumbnail_url,
              alt_text: item.alt_text,
            })),
          }
        : undefined;

    await supabase
      .from("posts")
      .update({
        ...toMediaRefreshFields(media, new Date().toISOString()),
        ...(children ? { children } : {}),
      })
      .eq("id", postId)
      .eq("user_id", userId);

    return NextResponse.json({
      media_url: media.media_url ?? null,
      thumbnail_url: media.thumbnail_url ?? null,
      alt_text: media.alt_text ?? null,
      gif_url: media.gif_url ?? null,
      carousel,
    });
  } catch (error) {
    console.error("Failed to refresh post media", { postId, error });
    return NextResponse.json(
      { error: "Failed to refresh media" },
      { status: 502 },
    );
  }
}
