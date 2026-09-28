import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { confirmAction, confirmDelete } from '../../lib/confirm';
import ExpandableRow from '../../components/admin/ExpandableRow';

export default function AdminInterest() {
  const { session } = useAdminAuth();
  const token = session.token;
  const { refreshUnreadInterest } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [settings, setSettings] = useState(null);
  const [slotsInput, setSlotsInput] = useState('');
  const [savingSlots, setSavingSlots] = useState(false);

  const [sendingShortlist, setSendingShortlist] = useState(false);
  const [shortlistResult, setShortlistResult] = useState(null);

  const [locations, setLocations] = useState([]);
  const [locationChoice, setLocationChoice] = useState({}); // { [registrationId]: locationId }

  function load() {
    setLoading(true);
    api.adminListInterest(token).then(setRows).finally(() => setLoading(false));
  }

  function loadSettings() {
    api.adminGetInterestSettings(token).then((s) => {
      setSettings(s);
      setSlotsInput(String(s.slotsTotal));
    });
  }

  useEffect(load, [token]);
  useEffect(loadSettings, [token]);
  useEffect(() => {
    api.getLocations().then(setLocations);
  }, []);

  // Visiting this tab clears the "unread" badge — mark everything read once
  // loaded, then let the layout refresh its count.
  useEffect(() => {
    api.adminMarkAllInterestRead(token).then(() => {
      refreshUnreadInterest();
      setRows((prev) => prev.map((r) => (r.readAt ? r : { ...r, readAt: new Date().toISOString() })));
    });
  }, [token, refreshUnreadInterest]);

  async function toggleRead(row) {
    setBusyId(row.id);
    try {
      const updated = await api.adminMarkInterestRead(token, row.id, !row.readAt);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      refreshUnreadInterest();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleShortlisted(row) {
    setBusyId(row.id);
    try {
      const updated = await api.adminSetInterestShortlisted(token, row.id, !row.shortlisted);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } finally {
      setBusyId(null);
    }
  }

  // Moving someone to/from "First taste" changes how many first-taste slots
  // are taken, so refresh the slots card alongside the row itself.
  async function toggleClaimedSlot(row) {
    setBusyId(row.id);
    try {
      const updated = await api.adminSetInterestClaimedSlot(token, row.id, !row.claimedSlot);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      loadSettings();
    } finally {
      setBusyId(null);
    }
  }

  async function createOrder(row) {
    const locationId = locationChoice[row.id] || locations[0]?.id;
    if (!locationId) return;
    const location = locations.find((l) => l.id === locationId);
    const ok = await confirmAction({
      title: 'Create their first-taste order?',
      text: `A free order will be created for ${row.name}, delivering to "${location?.name}", and confirmed right away.`,
      confirmButtonText: 'Create order',
      icon: 'question',
    });
    if (!ok) return;

    setBusyId(row.id);
    try {
      const { order } = await api.adminCreateFirstTasteOrder(token, row.id, locationId);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, orderId: order.id } : r)));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRegistration(row) {
    if (!(await confirmDelete(`${row.name}'s interest registration`))) return;
    setBusyId(row.id);
    try {
      await api.adminDeleteInterest(token, row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } finally {
      setBusyId(null);
    }
  }

  async function saveSlots(e) {
    e.preventDefault();
    const slots = Number(slotsInput);
    if (!Number.isInteger(slots) || slots < 0) return;
    setSavingSlots(true);
    try {
      setSettings(await api.adminUpdateInterestSettings(token, slots));
    } finally {
      setSavingSlots(false);
    }
  }

  const shortlistedCount = rows.filter((r) => r.shortlisted).length;
  const pendingShortlistCount = rows.filter((r) => r.shortlisted && !r.finalEmailSentAt).length;

  async function sendShortlistEmails() {
    if (pendingShortlistCount === 0) return;
    const ok = await confirmAction({
      title: 'Send the "you made the list" email?',
      text: `This emails ${pendingShortlistCount} shortlisted customer${pendingShortlistCount === 1 ? '' : 's'} who haven't been emailed yet.`,
      confirmButtonText: 'Send email',
      icon: 'question',
    });
    if (!ok) return;
    setSendingShortlist(true);
    setShortlistResult(null);
    try {
      const result = await api.adminSendShortlistEmails(token);
      setShortlistResult(result);
      load();
    } finally {
      setSendingShortlist(false);
    }
  }

  return (
    <div className="stack">
      <h2 className="section-title">Interested</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        People who registered their interest on the coming-soon page and want to hear when ordering opens.
      </p>

      {settings && (
        <form className="card row--between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }} onSubmit={saveSlots}>
          <div>
            <strong>First-taste slots</strong>
            <p className="muted" style={{ margin: '2px 0 0' }}>
              {settings.slotsClaimed} of {settings.slotsTotal} claimed &middot; {settings.slotsRemaining} left
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input
              type="number"
              min={0}
              value={slotsInput}
              onChange={(e) => setSlotsInput(e.target.value)}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', width: 90 }}
            />
            <button className="btn btn--primary btn--small" type="submit" disabled={savingSlots}>
              {savingSlots ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <div className="card row--between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <strong>
            Shortlisted customers{' '}
            <span className="muted" style={{ fontWeight: 400 }}>({shortlistedCount})</span>
          </strong>
          <p className="muted" style={{ margin: '2px 0 0' }}>
            {pendingShortlistCount === 0
              ? 'None waiting on the "you made the list" email.'
              : `${pendingShortlistCount} not yet emailed.`}
          </p>
          {shortlistResult && (
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Sent {shortlistResult.sent}
              {shortlistResult.failed.length > 0 && ` — failed for: ${shortlistResult.failed.join(', ')}`}
            </p>
          )}
        </div>
        <button
          className="btn btn--primary btn--small"
          type="button"
          disabled={sendingShortlist || pendingShortlistCount === 0}
          onClick={sendShortlistEmails}
        >
          {sendingShortlist ? 'Sending…' : 'Send email to shortlisted'}
        </button>
      </div>

      {loading ? (
        <p>Loading&hellip;</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Slot</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <ExpandableRow
                  key={r.id}
                  colSpan={8}
                  rowStyle={{ fontWeight: r.readAt ? 400 : 700 }}
                  summary={
                    <>
                      <td className="muted" style={{ fontWeight: 400 }}>{i + 1}</td>
                      <td className="muted" style={{ fontWeight: 400 }}>{formatDate(r.createdAt)}</td>
                      <td>{r.name}</td>
                      <td className="muted" style={{ fontWeight: 400 }}>{r.email}</td>
                      <td className="muted" style={{ fontWeight: 400 }}>{r.phone}</td>
                      <td className="muted" style={{ fontWeight: 400 }}>{r.address}</td>
                      <td>
                        <button
                          className="btn btn--ghost btn--small"
                          disabled={busyId === r.id}
                          onClick={(e) => { e.stopPropagation(); toggleClaimedSlot(r); }}
                        >
                          {r.claimedSlot ? 'First taste ✓' : 'General'}
                        </button>
                      </td>
                    </>
                  }
                  detail={
                    <>
                      <div className="detail-field">
                        <span className="detail-field__label">Landmark</span>
                        <span className="detail-field__value">{r.landmark || '—'}</span>
                      </div>
                      <div className="detail-field">
                        <span className="detail-field__label">Shortlist</span>
                        <span className="detail-field__value">
                          <div className="row" style={{ gap: 8 }}>
                            <button
                              className="btn btn--ghost btn--small"
                              disabled={busyId === r.id}
                              onClick={() => toggleShortlisted(r)}
                            >
                              {r.shortlisted ? 'Shortlisted ✓' : 'Shortlist'}
                            </button>
                            {r.finalEmailSentAt && <span className="muted" style={{ fontSize: '0.78rem' }}>Emailed</span>}
                          </div>
                        </span>
                      </div>
                      <div className="detail-field" style={{ gridColumn: 'span 2' }}>
                        <span className="detail-field__label">Order</span>
                        <span className="detail-field__value">
                          {r.orderId ? (
                            <span className="badge badge--confirmed">Order created</span>
                          ) : r.shortlisted ? (
                            <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                              <select
                                value={locationChoice[r.id] || locations[0]?.id || ''}
                                onChange={(e) => setLocationChoice((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: '0.82rem' }}
                              >
                                {locations.map((l) => (
                                  <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                              </select>
                              <button
                                className="btn btn--ghost btn--small"
                                disabled={busyId === r.id || locations.length === 0}
                                onClick={() => createOrder(r)}
                              >
                                Create order
                              </button>
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </span>
                      </div>
                      <div className="detail-field">
                        <span className="detail-field__label">What excites them</span>
                        <span className="detail-field__value">{r.excites || '—'}</span>
                      </div>
                      <div className="detail-actions">
                        <button
                          className="btn btn--ghost btn--small"
                          disabled={busyId === r.id}
                          onClick={() => toggleRead(r)}
                        >
                          {r.readAt ? 'Mark unread' : 'Mark read'}
                        </button>
                        <button
                          className="btn btn--danger btn--small"
                          disabled={busyId === r.id}
                          onClick={() => deleteRegistration(r)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  }
                />
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="muted">No one has registered interest yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
