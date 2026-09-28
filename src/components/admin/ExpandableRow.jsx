import { useState } from 'react';

/**
 * A `<table>` row that shows only its most identifying columns by default,
 * with the rest revealed in a detail panel when the row is clicked — for
 * admin tables with too many columns to read comfortably at a glance.
 *
 * `summary` — the visible `<td>`s (this component appends its own toggle
 * arrow cell after them, so `colSpan` should be summary's column count + 1).
 * `detail` — content for the expanded panel, typically `.detail-field`
 * blocks (see index.css) plus a trailing `.detail-actions` block for any
 * action buttons pulled out of the collapsed view.
 *
 * Any interactive control inside `summary` (a button, select, checkbox) must
 * stop event propagation on click/change, or it'll also toggle the row.
 */
export default function ExpandableRow({ summary, detail, colSpan, rowStyle }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="expandable-row" style={rowStyle} onClick={() => setOpen((o) => !o)}>
        {summary}
        <td className="expand-toggle-cell">{open ? '▾' : '▸'}</td>
      </tr>
      {open && (
        <tr className="detail-row">
          <td colSpan={colSpan}>
            <div className="detail-grid">{detail}</div>
          </td>
        </tr>
      )}
    </>
  );
}
