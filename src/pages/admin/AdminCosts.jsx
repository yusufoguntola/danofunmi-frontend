import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatNaira, formatDate } from '../../lib/format';
import { confirmDelete } from '../../lib/confirm';

const CATEGORIES = ['Ingredients', 'Packaging', 'Logistics', 'Staff', 'Utilities', 'Other'];

const emptyForm = {
  description: '',
  category: CATEGORIES[0],
  amount: '',
  incurredOn: new Date().toISOString().slice(0, 10),
};

export default function AdminCosts() {
  const { session } = useAdminAuth();
  const token = session.token;
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    api.adminListCosts(token).then(setCosts).finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.description || form.amount === '' || !form.incurredOn) {
      setError('Description, amount, and date are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.adminCreateCost(token, { ...form, amount: Number(form.amount) });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id, description) {
    if (!(await confirmDelete(`the cost entry "${description}"`))) return;
    await api.adminDeleteCost(token, id);
    load();
  }

  const total = costs.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="stack">
      <h2 className="section-title">Costs</h2>

      <form className="card stack" onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        <h3>Add a cost entry</h3>
        <div className="field">
          <label htmlFor="description">Description</label>
          <input
            id="description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="e.g. Rice & soup ingredients"
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="incurredOn">Date</label>
          <input
            id="incurredOn"
            type="date"
            value={form.incurredOn}
            onChange={(e) => setForm((f) => ({ ...f, incurredOn: e.target.value }))}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Add cost'}
        </button>
      </form>

      {loading ? (
        <p>Loading&hellip;</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id}>
                  <td>{formatDate(c.incurredOn)}</td>
                  <td>{c.description}</td>
                  <td>{c.category}</td>
                  <td>{formatNaira(c.amount)}</td>
                  <td>
                    <button className="btn btn--danger btn--small" onClick={() => handleDelete(c.id, c.description)}>Delete</button>
                  </td>
                </tr>
              ))}
              {costs.length === 0 && <tr><td colSpan={5} className="muted">No costs recorded yet.</td></tr>}
            </tbody>
            {costs.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}><strong>Total</strong></td>
                  <td colSpan={2}><strong>{formatNaira(total)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
