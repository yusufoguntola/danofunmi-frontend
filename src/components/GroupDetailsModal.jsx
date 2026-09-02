import Modal from './Modal';
import { formatNaira } from '../lib/format';
import MenuIcon from './MenuIcon';
import './GroupDetailsModal.css';

/** Shared "what's in this combo" breakdown — used by the read-only menu grid and the order builder. */
export default function GroupDetailsModal({ group, onClose, footer }) {
  return (
    <Modal title={group.name} onClose={onClose} panelClassName="group-details-modal__panel">
      <div className="stack">
        {group.description && <p className="muted">{group.description}</p>}

        <ul className="group-details__list">
          {group.items.map((item) => (
            <li key={item.id} className="group-details__item">
              <span className="group-details__item-name">
                <MenuIcon icon={item.icon} className="group-details__item-icon" imgClassName="group-details__item-icon-img" />{' '}
                {item.name}
                <span className="muted"> &middot; {item.size}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</span>
              </span>
              {item.isBonus ? (
                <span className="tag tag--bonus">Bonus &middot; free</span>
              ) : (
                <span>{formatNaira(item.unitPrice * item.quantity)}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="summary-total">
          <div className="row--between">
            <span className="muted">Items total</span>
            <span>{formatNaira(group.grossTotal)}</span>
          </div>
          {group.discount && (
            <div className="row--between">
              <span className="muted">
                Discount {group.discount.type === 'PERCENTAGE' ? `(${group.discount.value}%)` : ''}
              </span>
              <span>&minus;{formatNaira(group.discount.amount)}</span>
            </div>
          )}
          <div className="row--between summary-total__grand">
            <span>Combo price</span>
            <strong>{formatNaira(group.total)}</strong>
          </div>
        </div>

        {footer}
      </div>
    </Modal>
  );
}
