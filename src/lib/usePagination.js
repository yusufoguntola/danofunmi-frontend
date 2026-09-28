import { useMemo, useState } from 'react';

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Client-side pagination over an already-fetched array — every admin list in
 * this app loads its full result set in one request (small pre-launch
 * volumes), so slicing a page out of it here is simpler and safer than
 * threading offset/limit through every backend endpoint. Resets to page 1
 * whenever the page size changes or the underlying `items` array shrinks
 * below the current page (e.g. after a delete), so the view never shows an
 * empty page just because a stale page number is out of range.
 *
 * `start` is 0-based — combine with the page slice's own index for a serial
 * number column that counts continuously across pages: `start + i + 1`.
 */
export function usePagination(items, defaultPageSize = DEFAULT_PAGE_SIZE_OPTIONS[0]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  function changePageSize(size) {
    setPageSize(size);
    setPage(1);
  }

  return { pageItems, page: safePage, setPage, pageSize, changePageSize, pageCount, total, start };
}
