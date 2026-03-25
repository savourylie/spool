export const STORED_POST_MEDIA_TYPES = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "CAROUSEL",
] as const;

export type StoredPostMediaType = (typeof STORED_POST_MEDIA_TYPES)[number];

const THREADS_MEDIA_TYPE_ALIASES = {
  TEXT_POST: "TEXT",
  IMAGE_POST: "IMAGE",
  VIDEO_POST: "VIDEO",
  CAROUSEL_POST: "CAROUSEL",
  CAROUSEL_ALBUM: "CAROUSEL",
} as const satisfies Record<string, StoredPostMediaType>;

function isStoredPostMediaType(
  mediaType: string,
): mediaType is StoredPostMediaType {
  return STORED_POST_MEDIA_TYPES.includes(mediaType as StoredPostMediaType);
}

export function normalizeThreadsMediaType(
  mediaType: string,
): StoredPostMediaType {
  const aliasedMediaType = THREADS_MEDIA_TYPE_ALIASES[mediaType as keyof typeof THREADS_MEDIA_TYPE_ALIASES];

  if (aliasedMediaType) {
    return aliasedMediaType;
  }

  if (isStoredPostMediaType(mediaType)) {
    return mediaType;
  }

  throw new Error(`Unsupported Threads media type: ${mediaType}`);
}
