import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatNaira } from '../../lib/format';

export default function AdminReports() {
  const { session } = useAdminAuth();
  const token = session.token;
  const [range, setRange] = useState({ from: '', to: '' });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  function load(params = range) {
    setLoading(true);
    const query = {};
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    api.adminGetPnl(token, query).then(setReport).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stack">
      <h2 className="section-title">Revenue &amp; cost (P&amp;L)</h2>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="from">From</label>
          <input id="from" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="to">To</label>
          <input id="to" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </div>
        <button className="btn btn--ghost" type="submit" style={{ alignSelf: 'flex-end' }}>Apply</button>
        <button
          className="btn btn--ghost"
          type="button"
          style={{ alignSelf: 'flex-end' }}
          onClick={() => { setRange({ from: '', to: '' }); load({ from: '', to: '' }); }}
        >
          All time
        </button>
      </form>

      {loading || !report ? (
        <p>Loading&hellip;</p>
      ) : (
        <>
          <div className="report-stats">
            <div className="card report-stat">
              <span className="muted">Revenue</span>
              <strong>{formatNaira(report.revenue)}</strong>
              <span className="muted" style={{ fontSize: '0.78rem' }}>{report.ordersCount} paid orders</span>
            </div>
            <div className="card report-stat">
              <span className="muted">Total cost</span>
              <strong>{formatNaira(report.totalCost)}</strong>
            </div>
            <div className="card report-stat">
              <span className="muted">Net profit</span>
              <strong style={{ color: report.netProfit >= 0 ? 'var(--green-700)' : 'var(--red)' }}>
                {formatNaira(report.netProfit)}
              </strong>
            </div>
          </div>

          <div className="card">
            <h4>Revenue breakdown</h4>
            <div className="row--between"><span className="muted">Food sales</span><span>{formatNaira(report.foodRevenue)}</span></div>
            <div className="row--between"><span className="muted">Logistics collected</span><span>{formatNaira(report.logisticsRevenue)}</span></div>
          </div>

          <div className="card">
            <h4>Cost by category</h4>
            {Object.keys(report.costByCategory).length === 0 && <p className="muted">No costs in this range.</p>}
            {Object.entries(report.costByCategory).map(([category, amount]) => (
              <div className="row--between" key={category}>
                <span className="muted">{category}</span>
                <span>{formatNaira(amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
