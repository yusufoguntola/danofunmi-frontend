import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api, ApiError } from '../../lib/api';
import { formatNaira } from '../../lib/format';
import IconPicker from '../../components/IconPicker';
import MenuIcon from '../../components/MenuIcon';
import { confirmAction, confirmDelete } from '../../lib/confirm';

export default function AdminMenuGroupEdit() {
  const { session } = useAdminAuth();
  const token = session.token;
  const { id } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState(null);
  const [itemDrafts, setItemDrafts] = useState({});
  const [newItem, setNewItem] = useState({ menuItemOptionId: '', quantity: 1, isBonus: false });
  const [addItemError, setAddItemError] = useState(null);

  const optionChoices = useMemo(
    () =>
      items.flatMap((item) =>
        item.options.map((o) => ({ id: o.id, label: `${item.name} — ${o.size} (${formatNaira(o.price)})` }))
      ),
    [items]
  );

  function load() {
    setLoading(true);
    Promise.all([api.adminGetGroup(token, id), api.adminListMenu(token), api.adminListCategories(token)])
      .then(([groupData, menuItems, cats]) => {
        setGroup(groupData);
        setItems(menuItems);
        setCategories(cats);
        setForm({
          name: groupData.name,
          categoryId: groupData.categoryId,
          description: groupData.description || '',
          icon: groupData.icon || '',
          active: groupData.active,
          discountType: groupData.discount?.type || '',
          discountValue: groupData.discount?.value ?? '',
        });
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Could not load this combo.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token, id]);

  async function handleSave(e) {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    if (form.discountType && form.discountValue === '') {
      setSaveError('Enter a discount value, or clear the discount type.');
      return;
    }
    setBusy(true);
    try {
      await api.adminUpdateGroup(token, id, {
        name: form.name,
        categoryId: form.categoryId,
        description: form.description,
        icon: form.icon,
        active: form.active,
        discountType: form.discountType || null,
        discountValue: form.discountType ? Number(form.discountValue) : null,
      });
      setSaved(true);
      load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ok = await confirmAction({
      title: `Delete "${group.name}"?`,
      text: "This removes the combo. This can't be undone.",
      confirmButtonText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.adminDeleteGroup(token, id);
      navigate('/admin/menu/groups');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not delete this combo.');
      setBusy(false);
    }
  }

  function itemDraft(groupItem) {
    return itemDrafts[groupItem.id] ?? { quantity: groupItem.quantity, isBonus: groupItem.isBonus };
  }

  function setItemDraftField(groupItem, patch) {
    setItemDrafts((prev) => ({ ...prev, [groupItem.id]: { ...itemDraft(groupItem), ...patch } }));
  }

  async function saveItem(groupItem) {
    setBusy(true);
    try {
      await api.adminUpdateGroupItem(token, groupItem.id, itemDrafts[groupItem.id]);
      setItemDrafts((prev) => {
        const next = { ...prev };
        delete next[groupItem.id];
        return next;
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(groupItem) {
    if (!(await confirmDelete(`"${groupItem.name}" from this combo`))) return;
    setBusy(true);
    try {
      await api.adminDeleteGroupItem(token, groupItem.id);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not remove this item.');
    } finally {
      setBusy(false);
    }
  }

  async function addItem(e) {
    e.preventDefault();
    setAddItemError(null);
    if (!newItem.menuItemOptionId) {
      setAddItemError('Pick an item and size to add.');
      return;
    }
    setBusy(true);
    try {
      await api.adminAddGroupItem(token, id, newItem);
      setNewItem({ menuItemOptionId: '', quantity: 1, isBonus: false });
      load();
    } catch (err) {
      setAddItemError(err instanceof ApiError ? err.message : 'Could not add this item.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading&hellip;</p>;
  if (loadError) return <p className="form-error">{loadError}</p>;
  if (!group || !form) return null;

  return (
    <div className="stack">
      <div className="row--between">
        <div>
          <Link to="/admin/menu/groups" className="muted" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
            &larr; Back to combos
          </Link>
          <h2 className="section-title" style={{ margin: '4px 0 0' }}>{group.name}</h2>
        </div>
        <button className="btn btn--danger btn--small" disabled={busy} onClick={handleDelete}>
          Delete combo
        </button>
      </div>

      <form className="card stack" onSubmit={handleSave} style={{ maxWidth: 640 }}>
        <div className="field">
          <label>Icon</label>
          <IconPicker
            value={form.icon}
            onChange={(icon) => setForm((f) => ({ ...f, icon }))}
            name={form.name}
            description={form.description}
          />
        </div>

        <div className="field">
          <label htmlFor="groupName">Name</label>
          <input id="groupName" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="field">
          <label htmlFor="groupCategory">Category</label>
          <select
            id="groupCategory"
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="groupDescription">Description</label>
          <textarea
            id="groupDescription"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="groupDiscountType">Discount</label>
            <select
              id="groupDiscountType"
              value={form.discountType}
              onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
            >
              <option value="">No discount</option>
              <option value="PERCENTAGE">Percentage off</option>
              <option value="FLAT">Flat fee off</option>
            </select>
          </div>
          {form.discountType && (
            <div className="field">
              <label htmlFor="groupDiscountValue">
                {form.discountType === 'PERCENTAGE' ? 'Percent (%)' : 'Amount'}
              </label>
              <input
                id="groupDiscountValue"
                type="number"
                min="0"
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              />
            </div>
          )}
        </div>

        <label className="row" style={{ gap: 10, fontWeight: 700, fontSize: '0.9rem' }}>
          <span className="toggle">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span className="toggle__track" />
          </span>
          Active (visible to customers)
        </label>

        {saveError && <p className="form-error">{saveError}</p>}
        {saved && <p className="form-success">Saved.</p>}
        <button className="btn btn--primary" type="submit" disabled={busy}>
          Save changes
        </button>
      </form>

      <div className="card stack" style={{ maxWidth: 640 }}>
        <h3 style={{ margin: 0 }}>Included items</h3>
        <p className="muted" style={{ marginTop: -8, fontSize: '0.85rem' }}>
          The combo price is the sum of non-bonus items below, minus any discount. A bonus item is included
          for free and shown to customers as part of the combo, but never priced.
        </p>
        <div className="stack" style={{ gap: 8 }}>
          {group.items.map((groupItem) => {
            const draft = itemDraft(groupItem);
            const dirty = itemDrafts[groupItem.id] != null;
            return (
              <div className="row" key={groupItem.id} style={{ gap: 10, flexWrap: 'wrap' }}>
                <span style={{ minWidth: 160, fontWeight: 700, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <MenuIcon icon={groupItem.icon} imgClassName="menu-table__icon-img" />
                  {groupItem.name} <span className="muted">&middot; {groupItem.size}</span>
                </span>
                <span className="muted" style={{ fontSize: '0.85rem' }}>{formatNaira(groupItem.unitPrice)} ea.</span>
                <label className="row" style={{ gap: 6, fontSize: '0.85rem' }}>
                  Qty
                  <input
                    type="number"
                    min="1"
                    value={draft.quantity}
                    onChange={(e) => setItemDraftField(groupItem, { quantity: Number(e.target.value) })}
                    style={{ width: 60, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px' }}
                  />
                </label>
                <label className="row" style={{ gap: 6, fontSize: '0.8rem' }}>
                  <span className="toggle">
                    <input
                      type="checkbox"
                      checked={draft.isBonus}
                      onChange={(e) => setItemDraftField(groupItem, { isBonus: e.target.checked })}
                    />
                    <span className="toggle__track" />
                  </span>
                  Bonus (free)
                </label>
                {dirty && (
                  <button className="btn btn--ghost btn--small" disabled={busy} onClick={() => saveItem(groupItem)}>
                    Save
                  </button>
                )}
                <button className="btn btn--danger btn--small" disabled={busy} onClick={() => removeItem(groupItem)}>
                  Remove
                </button>
              </div>
            );
          })}

          <form className="row" onSubmit={addItem} style={{ gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <select
              value={newItem.menuItemOptionId}
              onChange={(e) => setNewItem((f) => ({ ...f, menuItemOptionId: e.target.value }))}
              style={{ minWidth: 220, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: '0.9rem' }}
            >
              <option value="">Select an item &amp; size</option>
              {optionChoices.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={newItem.quantity}
              onChange={(e) => setNewItem((f) => ({ ...f, quantity: Number(e.target.value) }))}
              style={{ width: 70, border: '1px dashed var(--line)', borderRadius: 8, padding: '6px 8px' }}
            />
            <label className="row" style={{ gap: 6, fontSize: '0.8rem' }}>
              <input
                type="checkbox"
                checked={newItem.isBonus}
                onChange={(e) => setNewItem((f) => ({ ...f, isBonus: e.target.checked }))}
              />
              Bonus
            </label>
            <button className="btn btn--ghost btn--small" type="submit" disabled={busy}>
              + Add item
            </button>
          </form>
          {addItemError && <p className="form-error">{addItemError}</p>}
        </div>

        <div className="summary-total" style={{ borderTop: '2px solid var(--green-100)', paddingTop: 14, marginTop: 8 }}>
          <div className="row--between"><span className="muted">Items total</span><span>{formatNaira(group.grossTotal)}</span></div>
          {group.discount && (
            <div className="row--between">
              <span className="muted">Discount</span>
              <span>&minus;{formatNaira(group.discount.amount)}</span>
            </div>
          )}
          <div className="row--between" style={{ fontWeight: 700 }}>
            <span>Combo price</span>
            <strong>{formatNaira(group.total)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
