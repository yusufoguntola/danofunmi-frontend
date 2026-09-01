import { useState } from 'react';
import { formatNaira } from '../lib/format';
import GroupDetailsModal from './GroupDetailsModal';
import './MenuGrid.css';

/** The category-grouped menu grid — shared by LandingPage's #menu section and MenuPage. */
export default function MenuGrid({ menu, categories }) {
  const [openGroup, setOpenGroup] = useState(null);

  return (
    <div className="menu__cols">
      {categories.map((category) => (
        <div className="menu__col" key={category}>
          <h3 className="menu__col-title">{category}</h3>
          {menu
            .filter((entry) => entry.category === category)
            .map((entry) =>
              entry.type === 'group' ? (
                <div className="menu-item menu-item--group" key={entry.id}>
                  <span className="menu-item__icon">{entry.icon}</span>
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
                  <span className="menu-item__icon">{entry.icon}</span>
                  <div>
                    <h4>{entry.name}</h4>
                    <p>{entry.description}</p>
                  </div>
                  <span className="tag">{entry.options.map((o) => o.size).join(' · ')}</span>
                </div>
              )
            )}
          {category === categories[categories.length - 1] && (
            <div className="menu__note">
              <p>
                <strong>Bulk requests welcome.</strong> Want a custom combination or a larger
                quantity than listed? Any type — or combination — of food is available on
                request.
              </p>
            </div>
          )}
        </div>
      ))}

      {openGroup && <GroupDetailsModal group={openGroup} onClose={() => setOpenGroup(null)} />}
    </div>
  );
}
