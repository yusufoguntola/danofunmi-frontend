import { useState } from 'react';
import { formatNaira } from '../lib/format';
import { sendChatPrompt } from '../lib/chatBridge';
import GroupDetailsModal from './GroupDetailsModal';
import MenuIcon from './MenuIcon';
import './MenuGrid.css';

const BULK_REQUEST_PROMPT = "I'd like to make a bulk/custom request";

/** The category-grouped menu grid — shared by LandingPage's #menu section and MenuPage. */
export default function MenuGrid({ menu, categories }) {
  const [openGroup, setOpenGroup] = useState(null);
  const [bulkRequestSent, setBulkRequestSent] = useState(false);

  function requestBulkOrder() {
    setBulkRequestSent(true);
    sendChatPrompt(BULK_REQUEST_PROMPT);
    setTimeout(() => setBulkRequestSent(false), 3000);
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

      <div className="menu__cols">
        {categories.map((category) => (
          <div className="menu__col" key={category}>
            <h3 className="menu__col-title">{category}</h3>
            {menu
              .filter((entry) => entry.category === category)
              .map((entry) =>
                entry.type === 'group' ? (
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
                    </div>
                  </div>
                ) : (
                  <div className="menu-item" key={entry.id}>
                    <MenuIcon icon={entry.icon} className="menu-item__icon" imgClassName="menu-item__icon-img" />
                    <div>
                      <h4>{entry.name}</h4>
                      <p>{entry.description}</p>
                    </div>
                    <span className="tag">{entry.options.map((o) => o.size).join(' · ')}</span>
                  </div>
                )
              )}
          </div>
        ))}
      </div>

      {openGroup && <GroupDetailsModal group={openGroup} onClose={() => setOpenGroup(null)} />}
    </div>
  );
}
