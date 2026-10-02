import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatNaira } from '../lib/format';
import { sendChatPrompt } from '../lib/chatBridge';
import GroupDetailsModal from './GroupDetailsModal';
import MenuIcon from './MenuIcon';
import './MenuGrid.css';

const BULK_REQUEST_PROMPT = "I'd like to make a bulk/custom request";

/** The category-grouped menu grid — shared by LandingPage's #menu section and
 * MenuPage. `showOrderLinks` adds a small "Start ordering" text link to each
 * item — on by default, MenuPage's own standalone browsing context (no other
 * order CTA on the page); LandingPage opts out since it already has its own
 * prominent "Start ordering" section right after the menu.
 *
 * `limit`, when given, switches from the full category-grouped columns to a
 * short flat preview — combos first (they're the highlight), then items, up
 * to `limit` entries — with a "View full menu" link to `menuPageHref` when
 * there's more to see. Used by LandingPage's teaser; omitted entirely by
 * MenuPage, which still shows everything grouped by category. */
export default function MenuGrid({ menu, categories, showOrderLinks = true, limit, menuPageHref = '/menu' }) {
  const [openGroup, setOpenGroup] = useState(null);
  const [bulkRequestSent, setBulkRequestSent] = useState(false);

  function requestBulkOrder() {
    setBulkRequestSent(true);
    sendChatPrompt(BULK_REQUEST_PROMPT);
    setTimeout(() => setBulkRequestSent(false), 3000);
  }

  function renderEntry(entry) {
    return entry.type === 'group' ? (
      <div className="menu-item menu-item--group" key={entry.id}>
        <MenuIcon icon={entry.icon} className="menu-item__icon" imgClassName="menu-item__icon-img" />
        <div>
          <h4>{entry.name}</h4>
          <p>{entry.description}</p>
        </div>
        <div className="menu-item__group-actions">
          <span className="tag">{formatNaira(entry.total)}</span>
          <button type="button" className="link-btn" onClick={() => setOpenGroup(entry)}>
            View details
          </button>
          {showOrderLinks && (
            <Link to="/order" className="link-btn menu-item__order-link">
              Start ordering &rarr;
            </Link>
          )}
        </div>
      </div>
    ) : (
      <div className="menu-item" key={entry.id}>
        <MenuIcon icon={entry.icon} className="menu-item__icon" imgClassName="menu-item__icon-img" />
        <div>
          <h4>{entry.name}</h4>
          <p>{entry.description}</p>
          {showOrderLinks && (
            <Link to="/order" className="link-btn menu-item__order-link">
              Start ordering &rarr;
            </Link>
          )}
        </div>
        <span className="tag">{entry.options.map((o) => o.size).join(' · ')}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="menu__note">
        <p>
          <strong>Bulk requests welcome.</strong> Want a custom combination or a larger
          quantity than listed? Any type — or combination — of food is available on
          request.
        </p>
        <button type="button" className="btn btn--small menu__note-cta" onClick={requestBulkOrder}>
          💬 Chat with us to request it
        </button>
        {bulkRequestSent && (
          <p className="menu__note-toast" role="status">Sending your request to our assistant…</p>
        )}
      </div>

      {limit ? (
        <>
          <div className="menu__preview-grid">
            {[...menu.filter((e) => e.type === 'group'), ...menu.filter((e) => e.type === 'item')]
              .slice(0, limit)
              .map(renderEntry)}
          </div>
          {menu.length > limit && (
            <div className="menu__view-all">
              <Link to={menuPageHref} className="btn btn--ghost">View full menu &rarr;</Link>
            </div>
          )}
        </>
      ) : (
        <div className="menu__cols">
          {categories.map((category) => (
            <div className="menu__col" key={category}>
              <h3 className="menu__col-title">{category}</h3>
              {menu.filter((entry) => entry.category === category).map(renderEntry)}
            </div>
          ))}
        </div>
      )}

      {openGroup && <GroupDetailsModal group={openGroup} onClose={() => setOpenGroup(null)} />}
    </div>
  );
}
