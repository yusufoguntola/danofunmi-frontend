import './MenuGrid.css';

/** The category-grouped menu grid — shared by LandingPage's #menu section and MenuPage. */
export default function MenuGrid({ menu, categories }) {
  return (
    <div className="menu__cols">
      {categories.map((category) => (
        <div className="menu__col" key={category}>
          <h3 className="menu__col-title">{category}</h3>
          {menu
            .filter((item) => item.category === category)
            .map((item) => (
              <div className="menu-item" key={item.id}>
                <span className="menu-item__icon">{item.icon}</span>
                <div>
                  <h4>{item.name}</h4>
                  <p>{item.description}</p>
                </div>
                <span className="tag">{item.options.map((o) => o.size).join(' · ')}</span>
              </div>
            ))}
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
    </div>
  );
}
