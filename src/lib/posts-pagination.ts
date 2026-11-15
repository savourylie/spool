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

// The Posts page's own address with the page param dropped and every other
// param (sort, order, filters) kept as it was, in its original order. Where to
// go when the requested page is past the last one.
export function getPostsFirstPageHref(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || value === undefined) continue;

    for (const item of Array.isArray(value) ? value : [value]) {
      query.append(key, item);
    }
  }

  const queryString = query.toString();
  return queryString ? `/dashboard/posts?${queryString}` : "/dashboard/posts";
}
