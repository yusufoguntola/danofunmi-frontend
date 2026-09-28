import { DEFAULT_PAGE_SIZE_OPTIONS } from '../../lib/usePagination';

/**
 * Standard admin-table pagination footer — page size dropdown + prev/next.
 * Renders nothing when there's nothing to page through, so it's safe to
 * always include regardless of row count.
 */
export default function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}) {
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="row--between pagination">
      <span className="muted" style={{ fontSize: '0.85rem' }}>
        {start}&ndash;{end} of {total}
      </span>
      <div className="row" style={{ gap: 10 }}>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Rows per page"
          style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: '0.85rem' }}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </button>
        <span className="muted" style={{ fontSize: '0.85rem' }}>Page {page} of {pageCount}</span>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
