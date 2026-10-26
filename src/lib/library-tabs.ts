export const LIBRARY_TABS = ["posts", "replies", "media", "reposts"] as const;

export type LibraryTab = (typeof LIBRARY_TABS)[number];

export const LIBRARY_TAB_LABELS: Record<LibraryTab, string> = {
  posts: "Posts",
  replies: "Replies",
  media: "Media",
  reposts: "Reposts",
};

export function isLibraryTab(value: string): value is LibraryTab {
  return (LIBRARY_TABS as readonly string[]).includes(value);
}
