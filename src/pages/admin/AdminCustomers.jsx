import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { usePagination } from '../../lib/usePagination';
import Pagination from '../../components/admin/Pagination';

export default function AdminCustomers() {
  const { session } = useAdminAuth();
  const token = session.token;
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.adminListCustomers(token).then(setCustomers).finally(() => setLoading(false));
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.phone, c.email].some((field) => field?.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const { pageItems, page, setPage, pageSize, changePageSize, pageCount, total, start } = usePagination(filtered);

  return (
    <div className="stack">
      <h2 className="section-title">Customers</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Everyone with an account or a guest order on file — {customers.length} total.
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, phone, or email&hellip;"
        style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', maxWidth: 360 }}
      />

      {loading ? (
        <p>Loading&hellip;</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Orders</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c, i) => (
                <tr
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/restricted-path/customers/${c.id}`)}
                >
                  <td className="muted">{start + i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{c.name}</td>
                  <td className="muted">{c.phone || '—'}</td>
                  <td className="muted">{c.email || '—'}</td>
                  <td className="muted">{c.orderCount}</td>
                  <td className="muted">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr><td colSpan={6} className="muted">{search ? 'No customers match your search.' : 'No customers yet.'}</td></tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
          />
        </div>
      )}
    </div>
  );
}
