import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatNaira } from '../../lib/format';
import { usePagination } from '../../lib/usePagination';
import Pagination from '../../components/admin/Pagination';

export default function AdminLocations() {
  const { session } = useAdminAuth();
  const token = session.token;
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [newLocation, setNewLocation] = useState({ name: '', logisticsFee: '' });
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    api.adminListLocations(token).then(setLocations).finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  // Keyed by location id so draftFor(id) can always fall back to that row's
  // real fetched values — not just whatever happens to already be in
  // `drafts` — so that editing one field (e.g. name) on a row for the first
  // time doesn't blow away its other, untouched fields (e.g. logisticsFee,
  // active) to undefined.
  function draftFor(id) {
    if (drafts[id]) return drafts[id];
    const loc = locations.find((l) => l.id === id);
    return loc ? { name: loc.name, logisticsFee: loc.logisticsFee, active: loc.active } : { name: '', logisticsFee: '', active: false };
  }

  function setDraft(id, patch) {
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(id), ...patch } }));
  }

  async function saveLocation(loc) {
    const draft = draftFor(loc.id);
    await api.adminUpdateLocation(token, loc.id, draft);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[loc.id];
      return next;
    });
    load();
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    if (!newLocation.name || newLocation.logisticsFee === '') {
      setError('Name and logistics fee are required.');
      return;
    }
    try {
      await api.adminCreateLocation(token, {
        name: newLocation.name,
        logisticsFee: Number(newLocation.logisticsFee),
      });
      setNewLocation({ name: '', logisticsFee: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const { pageItems, page, setPage, pageSize, changePageSize, pageCount, total, start } = usePagination(locations);

  return (
    <div className="stack">
      <h2 className="section-title">Locations &amp; logistics fees</h2>

      {loading ? (
        <p>Loading&hellip;</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Logistics fee</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((loc, i) => {
                const draft = draftFor(loc.id);
                const dirty = drafts[loc.id] != null;
                return (
                  <tr key={loc.id}>
                    <td className="muted">{start + i + 1}</td>
                    <td>
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft(loc.id, { name: e.target.value })}
                        style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={draft.logisticsFee}
                        onChange={(e) => setDraft(loc.id, { logisticsFee: e.target.value })}
                        style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', width: 110 }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(e) => setDraft(loc.id, { active: e.target.checked })}
                      />
                    </td>
                    <td>
                      {dirty && (
                        <button className="btn btn--primary btn--small" onClick={() => saveLocation(loc)}>
                          Save
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr><td colSpan={5} className="muted">No locations yet — add one below.</td></tr>
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

      <form className="card stack" onSubmit={handleCreate} style={{ maxWidth: 420 }}>
        <h3>Add a location</h3>
        <div className="field">
          <label htmlFor="newLocName">Name</label>
          <input
            id="newLocName"
            value={newLocation.name}
            onChange={(e) => setNewLocation((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Challenge, Ibadan"
          />
        </div>
        <div className="field">
          <label htmlFor="newLocFee">Logistics fee ({formatNaira(0).replace(/[\d.,]/g, '').trim()})</label>
          <input
            id="newLocFee"
            type="number"
            min="0"
            value={newLocation.logisticsFee}
            onChange={(e) => setNewLocation((f) => ({ ...f, logisticsFee: e.target.value }))}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn--primary" type="submit">Add location</button>
      </form>
    </div>
  );
}
