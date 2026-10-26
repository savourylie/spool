export interface YouTubeLink {
  id: string;
  canonicalUrl: string;
  thumbnailUrl: string;
}

export interface LinkPreviewMetadata {
  title: string | null;
  siteName: string | null;
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * Parses the YouTube URL shapes that show up in Threads posts. Returns null for
 * every other host so callers can fall back to a generic link card.
 */
export function parseYouTubeUrl(raw: string): YouTubeLink | null {
  const value = raw.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

  let id: string | null = null;

  if (url.hostname === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      segments[0] === "shorts" ||
      segments[0] === "embed" ||
      segments[0] === "live" ||
      segments[0] === "v"
    ) {
      id = segments[1] ?? null;
    }
  }

  if (!id || !YOUTUBE_ID.test(id)) return null;

  return {
    id,
    canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

export function getLinkSiteName(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

interface YouTubeOEmbedResponse {
  title?: string;
  author_name?: string;
}

/**
 * Best-effort metadata for the link card. YouTube gets a real title from the
 * public oEmbed endpoint; every other host is represented by its domain so a
 * slow third-party page can never block a sync.
 */
export async function resolveLinkPreview(
  raw: string,
): Promise<LinkPreviewMetadata | null> {
  const youtube = parseYouTubeUrl(raw);
  if (!youtube) {
    const siteName = getLinkSiteName(raw);
    return siteName ? { title: null, siteName } : null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(youtube.canonicalUrl)}&format=json`,
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return { title: null, siteName: "YouTube" };
    }

    const data = (await response.json()) as YouTubeOEmbedResponse;
    return {
      title: typeof data.title === "string" ? data.title : null,
      siteName: "YouTube",
    };
  } catch {
    return { title: null, siteName: "YouTube" };
  } finally {
    clearTimeout(timeout);
  }
}
