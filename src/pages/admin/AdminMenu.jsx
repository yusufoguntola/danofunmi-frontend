import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { api, ApiError } from '../../lib/api';
import { formatNaira } from '../../lib/format';
import Modal from '../../components/Modal';
import IconPicker from '../../components/IconPicker';
import { confirmAction, confirmDelete } from '../../lib/confirm';

const emptyNewItem = { name: '', categoryId: '', description: '', icon: '', size: '', price: '' };

function priceRange(options) {
  if (!options || options.length === 0) return '—';
  const prices = options.map((o) => Number(o.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatNaira(min) : `${formatNaira(min)} – ${formatNaira(max)}`;
}

function IconThumb({ icon }) {
  const isImage = typeof icon === 'string' && /^(\/uploads\/|https?:\/\/)/.test(icon);
  if (isImage) {
    return <img src={icon.startsWith('http') ? icon : `${api.BASE_URL}${icon}`} alt="" className="menu-table__icon-img" />;
  }
  return <span className="menu-table__icon-emoji">{icon || '🍲'}</span>;
}

export default function AdminMenu() {
  const { session } = useAdminAuth();
  const token = session.token;
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState(null);

  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryError, setEditCategoryError] = useState(null);

  const [showItemModal, setShowItemModal] = useState(false);
  const [newItem, setNewItem] = useState(emptyNewItem);
  const [newItemError, setNewItemError] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.adminListMenu(token), api.adminListCategories(token)])
      .then(([menuItems, cats]) => {
        setItems(menuItems);
        setCategories(cats);
        setNewItem((f) => (f.categoryId ? f : { ...f, categoryId: cats[0]?.id || '' }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  // --- Categories ---
  function openEditCategory(cat) {
    setEditingCategory(cat);
    setEditCategoryName(cat.name);
    setEditCategoryError(null);
  }

  async function handleSaveCategory(e) {
    e.preventDefault();
    setEditCategoryError(null);
    if (!editCategoryName.trim()) {
      setEditCategoryError('Give the category a name.');
      return;
    }
    setBusy(true);
    try {
      await api.adminUpdateCategory(token, editingCategory.id, { name: editCategoryName.trim() });
      setEditingCategory(null);
      load();
    } catch (err) {
      setEditCategoryError(err instanceof ApiError ? err.message : 'Could not rename category.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(cat) {
    if (!(await confirmDelete(`the "${cat.name}" category`))) return;
    setBusy(true);
    try {
      await api.adminDeleteCategory(token, cat.id);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not delete category.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCategory(e) {
    e.preventDefault();
    setCategoryError(null);
    if (!newCategoryName.trim()) {
      setCategoryError('Give the category a name.');
      return;
    }
    setBusy(true);
    try {
      await api.adminCreateCategory(token, { name: newCategoryName.trim() });
      setNewCategoryName('');
      setShowCategoryModal(false);
      load();
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : 'Could not create category.');
    } finally {
      setBusy(false);
    }
  }

  // --- Items ---
  async function toggleActive(item) {
    setBusy(true);
    try {
      await api.adminUpdateMenuItem(token, item.id, { active: !item.active });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(item) {
    const ok = await confirmAction({
      title: `Delete "${item.name}"?`,
      text: "This removes it and all its sizes. This can't be undone.",
      confirmButtonText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.adminDeleteMenuItem(token, item.id);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not delete this item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateItem(e) {
    e.preventDefault();
    setNewItemError(null);
    if (!newItem.name || !newItem.categoryId || !newItem.size || newItem.price === '') {
      setNewItemError('Name, category, and an initial size + price are required.');
      return;
    }
    setBusy(true);
    try {
      const created = await api.adminCreateMenuItem(token, {
        name: newItem.name,
        categoryId: newItem.categoryId,
        description: newItem.description,
        icon: newItem.icon,
        options: [{ size: newItem.size, price: Number(newItem.price) }],
      });
      setNewItem((f) => ({ ...emptyNewItem, categoryId: f.categoryId }));
      setShowItemModal(false);
      navigate(`/admin/menu/${created.id}`);
    } catch (err) {
      setNewItemError(err instanceof ApiError ? err.message : 'Could not create menu item.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row--between">
        <h2 className="section-title" style={{ margin: 0 }}>Menu</h2>
        <div className="row">
          <button className="btn btn--ghost btn--small" onClick={() => navigate('/admin/menu/groups')}>
            Combos
          </button>
          <button className="btn btn--ghost btn--small" onClick={() => setShowCategoryModal(true)}>
            + Add category
          </button>
          <button
            className="btn btn--primary btn--small"
            onClick={() => setShowItemModal(true)}
            disabled={categories.length === 0}
          >
            + Add menu item
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="stack">
        <h3 style={{ margin: 0 }}>Categories</h3>
        {!loading && (
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Items</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const itemCount = items.filter((i) => i.categoryId === cat.id).length;
                  return (
                    <tr key={cat.id}>
                      <td style={{ fontWeight: 700 }}>{cat.name}</td>
                      <td className="muted">{itemCount}</td>
                      <td>
                        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn btn--ghost btn--small" disabled={busy} onClick={() => openEditCategory(cat)}>
                            Edit
                          </button>
                          <button className="btn btn--danger btn--small" disabled={busy} onClick={() => deleteCategory(cat)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {categories.length === 0 && (
                  <tr><td colSpan={3} className="muted">No categories yet — add one above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="stack">
        <h3 style={{ margin: 0 }}>Menu items</h3>
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
                <th>Sizes</th>
                <th>Price</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><IconThumb icon={item.icon} /></td>
                  <td style={{ fontWeight: 700 }}>{item.name}</td>
                  <td className="muted">{item.category}</td>
                  <td className="muted">{item.options.length}</td>
                  <td>{priceRange(item.options)}</td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={item.active} disabled={busy} onChange={() => toggleActive(item)} />
                      <span className="toggle__track" />
                    </label>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn btn--ghost btn--small" onClick={() => navigate(`/admin/menu/${item.id}`)}>
                        Edit
                      </button>
                      <button className="btn btn--danger btn--small" disabled={busy} onClick={() => deleteItem(item)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="muted">No menu items yet — add one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {showCategoryModal && (
        <Modal title="Add a category" onClose={() => setShowCategoryModal(false)}>
          <form className="stack" onSubmit={handleCreateCategory}>
            <div className="field">
              <label htmlFor="newCategoryName">Name</label>
              <input
                id="newCategoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Drinks"
                autoFocus
              />
            </div>
            {categoryError && <p className="form-error">{categoryError}</p>}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              Add category
            </button>
          </form>
        </Modal>
      )}

      {editingCategory && (
        <Modal title="Edit category" onClose={() => setEditingCategory(null)}>
          <form className="stack" onSubmit={handleSaveCategory}>
            <div className="field">
              <label htmlFor="editCategoryName">Name</label>
              <input
                id="editCategoryName"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                autoFocus
              />
            </div>
            {editCategoryError && <p className="form-error">{editCategoryError}</p>}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              Save changes
            </button>
          </form>
        </Modal>
      )}

      {showItemModal && (
        <Modal title="Add a menu item" onClose={() => setShowItemModal(false)}>
          <form className="stack" onSubmit={handleCreateItem}>
            <div className="field">
              <label>Icon</label>
              <IconPicker
                value={newItem.icon}
                onChange={(icon) => setNewItem((f) => ({ ...f, icon }))}
                name={newItem.name}
                description={newItem.description}
              />
            </div>
            <div className="field">
              <label htmlFor="newItemName">Name</label>
              <input
                id="newItemName"
                value={newItem.name}
                onChange={(e) => setNewItem((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ofada Stew"
              />
            </div>
            <div className="field">
              <label htmlFor="newItemCategory">Category</label>
              <select
                id="newItemCategory"
                value={newItem.categoryId}
                onChange={(e) => setNewItem((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="" disabled>Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="newItemDescription">Description</label>
              <textarea
                id="newItemDescription"
                rows={2}
                value={newItem.description}
                onChange={(e) => setNewItem((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="newItemSize">Starting size</label>
                <input
                  id="newItemSize"
                  value={newItem.size}
                  onChange={(e) => setNewItem((f) => ({ ...f, size: e.target.value }))}
                  placeholder="e.g. 1L"
                />
              </div>
              <div className="field">
                <label htmlFor="newItemPrice">Price ({formatNaira(0).replace(/[\d.,]/g, '').trim()})</label>
                <input
                  id="newItemPrice"
                  type="number"
                  min="0"
                  value={newItem.price}
                  onChange={(e) => setNewItem((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
            </div>
            <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
              You can add more sizes afterward from the item's edit page.
            </p>
            {newItemError && <p className="form-error">{newItemError}</p>}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              Add menu item
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
