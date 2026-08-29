import { useRef, useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { api, ApiError } from '../lib/api';

const isImagePath = (value) => typeof value === 'string' && /^(\/uploads\/|https?:\/\/)/.test(value);

export default function IconPicker({ value, onChange, name, description }) {
  const { session } = useAdminAuth();
  const token = session.token;
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { path } = await api.adminUploadMenuIcon(token, file);
      onChange(path);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload image.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    if (!name) {
      setError('Type the item name first so AI knows what to draw.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { path } = await api.adminGenerateMenuIcon(token, { name, description });
      onChange(path);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate an icon.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="icon-picker">
      <div className="icon-picker__preview">
        {isImagePath(value) ? (
          <img src={value.startsWith('http') ? value : `${api.BASE_URL}${value}`} alt="" />
        ) : (
          <span>{value || '🍲'}</span>
        )}
      </div>

      <div className="icon-picker__controls">
        <input
          value={isImagePath(value) ? '' : value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Emoji"
          className="icon-picker__emoji-input"
        />
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload
        </button>
        <button type="button" className="btn btn--ghost btn--small" disabled={busy} onClick={handleGenerate}>
          {busy ? 'Working…' : 'Generate with AI'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {error && <p className="form-error" style={{ margin: '6px 0 0', fontSize: '0.78rem' }}>{error}</p>}
    </div>
  );
}
