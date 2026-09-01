import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api, ApiError } from '../../lib/api';
import { formatNaira } from '../../lib/format';
import Modal from '../../components/Modal';
import IconPicker from '../../components/IconPicker';
import { confirmAction } from '../../lib/confirm';

const emptyNewGroup = { name: '', categoryId: '', description: '', icon: '', menuItemOptionId: '' };

function discountLabel(discount) {
  if (!discount) return '—';
  return discount.type === 'PERCENTAGE' ? `${discount.value}%` : formatNaira(discount.value);
}

export default function AdminMenuGroups() {
  const { session } = useAdminAuth();
  const token = session.token;
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [newGroup, setNewGroup] = useState(emptyNewGroup);
  const [newGroupError, setNewGroupError] = useState(null);

  // Flat "Item — Size" choices for the starting-item picker.
  const optionChoices = useMemo(
    () =>
      items.flatMap((item) =>
        item.options.map((o) => ({ id: o.id, label: `${item.name} — ${o.size} (${formatNaira(o.price)})` }))
      ),
    [items]
  );

  function load() {
    setLoading(true);
    Promise.all([api.adminListGroups(token), api.adminListMenu(token), api.adminListCategories(token)])
      .then(([groupData, menuItems, cats]) => {
        setGroups(groupData);
        setItems(menuItems);
        setCategories(cats);
        setNewGroup((f) => ({ ...f, categoryId: f.categoryId || cats[0]?.id || '' }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function toggleActive(group) {
    setBusy(true);
    try {
      await api.adminUpdateGroup(token, group.id, { active: !group.active });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup(group) {
    const ok = await confirmAction({
      title: `Delete "${group.name}"?`,
      text: "This removes the combo. This can't be undone.",
      confirmButtonText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.adminDeleteGroup(token, group.id);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not delete this combo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setNewGroupError(null);
    if (!newGroup.name || !newGroup.categoryId || !newGroup.menuItemOptionId) {
      setNewGroupError('Name, category, and a starting item are required.');
      return;
    }
    setBusy(true);
    try {
      const created = await api.adminCreateGroup(token, {
        name: newGroup.name,
        categoryId: newGroup.categoryId,
        description: newGroup.description,
        icon: newGroup.icon,
        items: [{ menuItemOptionId: newGroup.menuItemOptionId, quantity: 1 }],
      });
      setNewGroup((f) => ({ ...emptyNewGroup, categoryId: f.categoryId }));
      setShowModal(false);
      navigate(`/admin/menu/groups/${created.id}`);
    } catch (err) {
      setNewGroupError(err instanceof ApiError ? err.message : 'Could not create this combo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row--between">
        <div>
          <Link to="/admin/menu" className="muted" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
            &larr; Back to menu
          </Link>
          <h2 className="section-title" style={{ margin: '4px 0 0' }}>Combos</h2>
        </div>
        <button
          className="btn btn--primary btn--small"
          onClick={() => setShowModal(true)}
          disabled={optionChoices.length === 0}
        >
          + Add combo
        </button>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>
        Bundle several menu items together at a combo price, with an optional discount and a free bonus item.
      </p>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading&hellip;</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Category</th>
                <th>Items</th>
                <th>Discount</th>
                <th>Combo price</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td style={{ fontSize: '1.4rem' }}>{group.icon || '🎁'}</td>
                  <td style={{ fontWeight: 700 }}>{group.name}</td>
                  <td className="muted">{group.category}</td>
                  <td className="muted">
                    {group.items.filter((i) => !i.isBonus).length} item(s)
                    {group.items.some((i) => i.isBonus) && ' + bonus'}
                  </td>
                  <td className="muted">{discountLabel(group.discount)}</td>
                  <td>{formatNaira(group.total)}</td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={group.active} disabled={busy} onChange={() => toggleActive(group)} />
                      <span className="toggle__track" />
                    </label>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn btn--ghost btn--small" onClick={() => navigate(`/admin/menu/groups/${group.id}`)}>
                        Edit
                      </button>
                      <button className="btn btn--danger btn--small" disabled={busy} onClick={() => deleteGroup(group)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr><td colSpan={8} className="muted">No combos yet — add one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title="Add a combo" onClose={() => setShowModal(false)}>
          <form className="stack" onSubmit={handleCreate}>
            <div className="field">
              <label>Icon</label>
              <IconPicker
                value={newGroup.icon}
                onChange={(icon) => setNewGroup((f) => ({ ...f, icon }))}
                name={newGroup.name}
                description={newGroup.description}
              />
            </div>
            <div className="field">
              <label htmlFor="newGroupName">Name</label>
              <input
                id="newGroupName"
                value={newGroup.name}
                onChange={(e) => setNewGroup((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Family Combo"
              />
            </div>
            <div className="field">
              <label htmlFor="newGroupCategory">Category</label>
              <select
                id="newGroupCategory"
                value={newGroup.categoryId}
                onChange={(e) => setNewGroup((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="" disabled>Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="newGroupDescription">Description</label>
              <textarea
                id="newGroupDescription"
                rows={2}
                value={newGroup.description}
                onChange={(e) => setNewGroup((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="newGroupItem">Starting item</label>
              <select
                id="newGroupItem"
                value={newGroup.menuItemOptionId}
                onChange={(e) => setNewGroup((f) => ({ ...f, menuItemOptionId: e.target.value }))}
              >
                <option value="" disabled>Select an item &amp; size</option>
                {optionChoices.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
              Add more items, a bonus item, and a discount from the combo's edit page afterward.
            </p>
            {newGroupError && <p className="form-error">{newGroupError}</p>}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              Add combo
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
