import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import MenuGrid from '../components/MenuGrid';
import SiteFooter from '../components/SiteFooter';
import './MenuPage.css';

export default function MenuPage() {
  const [menu, setMenu] = useState([]);
  const [menuError, setMenuError] = useState(null);

  useEffect(() => {
    api.getMenu().then(setMenu).catch((err) => setMenuError(err.message));
  }, []);

  const categories = [...new Set(menu.map((m) => m.category))];

  return (
    <div className="menu-page">
      <header className="menu-page__hero">
        <div className="wrap row--between">
          <Link className="menu-page__logo" to="/">dánọ́fúnmi</Link>
          <Link to="/order" className="btn btn--onlight btn--small">Order now</Link>
        </div>
      </header>

      <main className="wrap menu-page__body stack">
        <Link to="/orders" className="menu-page__back">&larr; Back to my orders</Link>
        <div>
          <h2 className="section-title">This month's menu</h2>
          <p className="section-sub">Pick any combination — every item is available in bulk.</p>
        </div>

        {menuError && <p className="form-error">{menuError}</p>}
        <MenuGrid menu={menu} categories={categories} />
      </main>

      <SiteFooter />
    </div>
  );
}
