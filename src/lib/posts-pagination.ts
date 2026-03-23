export const POSTS_PAGE_SIZE = 20;

interface PostsPageRangeOptions {
  currentPage: number;
  totalCount: number;
  pageItemCount: number;
  pageSize?: number;
}

export function getPostsTotalPages(
  totalCount: number,
  pageSize = POSTS_PAGE_SIZE,
) {
  if (totalCount <= 0) return 0;
  return Math.ceil(totalCount / pageSize);
}

export function getPostsPageRange({
  currentPage,
  totalCount,
  pageItemCount,
  pageSize = POSTS_PAGE_SIZE,
}: PostsPageRangeOptions) {
  if (totalCount <= 0 || pageItemCount <= 0) return null;

  const safePage = Math.max(1, currentPage);
  const safeItemCount = Math.min(Math.max(0, pageItemCount), pageSize);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(totalCount, start + safeItemCount - 1);

  return { start, end };
}
