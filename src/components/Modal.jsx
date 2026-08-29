import { useEffect } from 'react';
import './Modal.css';

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
