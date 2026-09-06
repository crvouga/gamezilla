export type PaginationWindowItem =
  | { readonly type: 'page'; readonly pageIndex: number }
  | { readonly type: 'ellipsis'; readonly id: 'start' | 'end' };

/**
 * Build the middle page-number strip for pagination controls.
 * When `pageCount` is small, every page is listed. Otherwise a window of
 * `siblingCount` pages on each side of the current page is shown, with
 * ellipsis markers when the window does not reach an edge.
 */
export function buildPaginationWindow(
  pageIndex: number,
  pageCount: number,
  siblingCount: number
): readonly PaginationWindowItem[] {
  if (pageCount <= 0) return [];
  const siblings = Math.max(0, siblingCount);
  const showAllThreshold = 2 * siblings + 3;
  if (pageCount <= showAllThreshold) {
    return Array.from({ length: pageCount }, (_, i) => ({
      type: 'page' as const,
      pageIndex: i,
    }));
  }
  const clamped = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const windowStart = Math.max(0, clamped - siblings);
  const windowEnd = Math.min(pageCount - 1, clamped + siblings);
  const items: PaginationWindowItem[] = [];
  if (windowStart > 0) {
    items.push({ type: 'ellipsis', id: 'start' });
  }
  for (let i = windowStart; i <= windowEnd; i++) {
    items.push({ type: 'page', pageIndex: i });
  }
  if (windowEnd < pageCount - 1) {
    items.push({ type: 'ellipsis', id: 'end' });
  }
  return items;
}
