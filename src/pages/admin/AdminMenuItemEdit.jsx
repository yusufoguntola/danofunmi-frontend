import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api, ApiError } from '../../lib/api';
import IconPicker from '../../components/IconPicker';
import { confirmAction, confirmDelete } from '../../lib/confirm';

export default function AdminMenuItemEdit() {
  const { session } = useAdminAuth();
  const token = session.token;
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState(null);
  const [optionDrafts, setOptionDrafts] = useState({});
  const [newOption, setNewOption] = useState({ size: '', price: '' });

  function load() {
    setLoading(true);
    Promise.all([api.adminGetMenuItem(token, id), api.adminListCategories(token)])
      .then(([itemData, cats]) => {
        setItem(itemData);
        setCategories(cats);
        setForm({
          name: itemData.name,
          categoryId: itemData.categoryId,
          description: itemData.description || '',
          icon: itemData.icon || '',
          active: itemData.active,
        });
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Could not load this item.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token, id]);

  async function handleSave(e) {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);
    setBusy(true);
    try {
      await api.adminUpdateMenuItem(token, id, form);
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
      title: `Delete "${item.name}"?`,
      text: "This removes it and all its sizes. This can't be undone.",
      confirmButtonText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.adminDeleteMenuItem(token, id);
      navigate('/admin/menu');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not delete this item.');
      setBusy(false);
    }
  }

  function optionDraft(option) {
    return optionDrafts[option.id] ?? { price: option.price, active: option.active };
  }

  function setOptionDraftField(option, patch) {
    setOptionDrafts((prev) => ({ ...prev, [option.id]: { ...optionDraft(option), ...patch } }));
  }

  async function saveOption(option) {
    setBusy(true);
    try {
      await api.adminUpdateMenuOption(token, option.id, optionDrafts[option.id]);
      setOptionDrafts((prev) => {
        const next = { ...prev };
        delete next[option.id];
        return next;
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteOption(option) {
    if (!(await confirmDelete(`the ${option.size} size`))) return;
    setBusy(true);
    try {
      await api.adminDeleteMenuOption(token, option.id);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not delete this size.');
    } finally {
      setBusy(false);
    }
  }

  async function addOption(e) {
    e.preventDefault();
    if (!newOption.size || newOption.price === '') return;
    setBusy(true);
    try {
      await api.adminAddMenuOption(token, id, { size: newOption.size, price: Number(newOption.price) });
      setNewOption({ size: '', price: '' });
      load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading&hellip;</p>;
  if (loadError) return <p className="form-error">{loadError}</p>;
  if (!item || !form) return null;

  return (
    <div className="stack">
      <div className="row--between">
        <div>
          <Link to="/admin/menu" className="muted" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
            &larr; Back to menu
          </Link>
          <h2 className="section-title" style={{ margin: '4px 0 0' }}>{item.name}</h2>
        </div>
        <button className="btn btn--danger btn--small" disabled={busy} onClick={handleDelete}>
          Delete item
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
          <label htmlFor="itemName">Name</label>
          <input id="itemName" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="field">
          <label htmlFor="itemCategory">Category</label>
          <select
            id="itemCategory"
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="itemDescription">Description</label>
          <textarea
            id="itemDescription"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
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
        <h3 style={{ margin: 0 }}>Sizes &amp; prices</h3>
        <div className="stack" style={{ gap: 8 }}>
          {item.options.map((option) => {
            const oDraft = optionDraft(option);
            const oDirty = optionDrafts[option.id] != null;
            return (
              <div className="row" key={option.id} style={{ gap: 10 }}>
                <span style={{ width: 60, fontWeight: 700, fontSize: '0.9rem' }}>{option.size}</span>
                <input
                  type="number"
                  min="0"
                  value={oDraft.price}
                  onChange={(e) => setOptionDraftField(option, { price: e.target.value })}
                  style={{ width: 110, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px' }}
                />
                <label className="row" style={{ gap: 6, fontSize: '0.8rem' }}>
                  <span className="toggle">
                    <input
                      type="checkbox"
                      checked={oDraft.active}
                      onChange={(e) => setOptionDraftField(option, { active: e.target.checked })}
                    />
                    <span className="toggle__track" />
                  </span>
                  Active
                </label>
                {oDirty && (
                  <button className="btn btn--ghost btn--small" disabled={busy} onClick={() => saveOption(option)}>
                    Save
                  </button>
                )}
                <button className="btn btn--danger btn--small" disabled={busy} onClick={() => deleteOption(option)}>
                  Remove
                </button>
              </div>
            );
          })}

          <form className="row" onSubmit={addOption} style={{ gap: 10, marginTop: 4 }}>
            <input
              value={newOption.size}
              onChange={(e) => setNewOption((f) => ({ ...f, size: e.target.value }))}
              placeholder="e.g. 3L"
              style={{ width: 90, border: '1px dashed var(--line)', borderRadius: 8, padding: '6px 8px' }}
            />
            <input
              type="number"
              min="0"
              value={newOption.price}
              onChange={(e) => setNewOption((f) => ({ ...f, price: e.target.value }))}
              placeholder="Price"
              style={{ width: 110, border: '1px dashed var(--line)', borderRadius: 8, padding: '6px 8px' }}
            />
            <button className="btn btn--ghost btn--small" type="submit" disabled={busy}>
              + Add size
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
