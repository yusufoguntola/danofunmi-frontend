import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { db } from '../lib/db';
import SiteFooter from '../components/SiteFooter';
import MenuGrid from '../components/MenuGrid';
import './LandingPage.css';

export default function LandingPage() {
  const [menu, setMenu] = useState([]);
  const [menuError, setMenuError] = useState(null);
  const [savedCart, setSavedCart] = useState(null);

  useEffect(() => {
    api.getMenu().then(setMenu).catch((err) => setMenuError(err.message));
    db.cart.get('draft').then((draft) => {
      if (draft?.items?.length) setSavedCart(draft);
    });
  }, []);

  const categories = [...new Set(menu.map((m) => m.category))];

  return (
    <div className="landing">
      <header className="nav">
        <div className="wrap nav__inner">
          <a className="logo" href="#top">dánọ́fúnmi</a>
          <nav className="nav__links">
            <a href="#menu">Menu</a>
            <a href="#how">How it works</a>
            <a href="#why">Why us</a>
            <a href="#contact">Contact</a>
            <Link to="/orders">My orders</Link>
          </nav>
          <Link className="btn btn--primary btn--small" to="/order">Order now</Link>
        </div>
      </header>

      {savedCart && (
        <div className="wrap continue-order">
          <span>
            🛒 You have an order in progress —{' '}
            {savedCart.items.reduce((n, l) => n + l.quantity, 0)} item(s) saved.
          </span>
          <Link to="/order" className="btn btn--primary btn--small">Continue your order</Link>
        </div>
      )}

      <main>
        <section className="hero" id="top">
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <span className="eyebrow">Monthly stock-up &middot; home-cooked in bulk</span>
              <h1>You choose,<br />we cook.</h1>
              <p className="hero__sub">Home-cooked, just for you.</p>
              <p className="hero__body">
                Once a month, stock your freezer with real home-cooked soups and rice — any
                type, any combination, made fresh and delivered exactly as requested.
              </p>
              <div className="hero__ctas">
                <Link to="/order" className="btn btn--primary">Start your order</Link>
                <a href="#menu" className="btn btn--ghost">See this month's menu</a>
              </div>
              <p className="hero__meaning">
                dánọ́fúnmi <span>&middot; from &ldquo;Dánọ́ fún mi&rdquo; — &ldquo;cook for me&rdquo;</span>
              </p>
            </div>

            <div className="hero__art" aria-hidden="true">
              <div className="stack">
                <div className="food-card food-card--1">
                  <span className="food-card__icon">🍲</span>
                  <span className="food-card__label">Buka Stew</span>
                </div>
                <div className="food-card food-card--2">
                  <span className="food-card__icon">🍛</span>
                  <span className="food-card__label">Party Jollof</span>
                </div>
                <div className="food-card food-card--3">
                  <span className="food-card__icon">🥬</span>
                  <span className="food-card__label">Efo Riro</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="how" id="how">
          <div className="how__doodles" aria-hidden="true">
            <span className="doodle" style={{ top: '6%', left: '5%', fontSize: '3.4rem', transform: 'rotate(-14deg)' }}>🍲</span>
            <span className="doodle" style={{ top: '9%', left: '91%', fontSize: '3rem', transform: 'rotate(11deg)' }}>🍛</span>
            <span className="doodle" style={{ top: '24%', left: '50%', fontSize: '2.1rem', transform: 'rotate(6deg)' }}>🍽️</span>
            <span className="doodle" style={{ top: '36%', left: '2%', fontSize: '2.7rem', transform: 'rotate(9deg)' }}>🥬</span>
            <span className="doodle" style={{ top: '32%', left: '96%', fontSize: '2.9rem', transform: 'rotate(-11deg)' }}>🥘</span>
            <span className="doodle" style={{ top: '58%', left: '7%', fontSize: '2.5rem', transform: 'rotate(15deg)' }}>🍃</span>
            <span className="doodle" style={{ top: '55%', left: '93%', fontSize: '3rem', transform: 'rotate(-9deg)' }}>🍚</span>
            <span className="doodle" style={{ top: '88%', left: '16%', fontSize: '2.3rem', transform: 'rotate(-7deg)' }}>🌶️</span>
            <span className="doodle" style={{ top: '90%', left: '82%', fontSize: '2.5rem', transform: 'rotate(13deg)' }}>🍗</span>
            <span className="doodle" style={{ top: '78%', left: '48%', fontSize: '2rem', transform: 'rotate(-5deg)' }}>🧅</span>
          </div>
          <div className="wrap">
            <h2 className="section-title">How it works</h2>
            <p className="section-sub">Simple, once a month.</p>
            <ol className="steps">
              <li className="step">
                <div className="step__head">
                  <span className="step__num">1</span>
                  <span className="step__icon" aria-hidden="true">🗓️</span>
                </div>
                <h3>Pick your month</h3>
                <p>Ordering opens once a month — mark your calendar so you don't miss the window.</p>
              </li>
              <li className="step">
                <div className="step__head">
                  <span className="step__num">2</span>
                  <span className="step__icon" aria-hidden="true">📝</span>
                </div>
                <h3>Choose your meals</h3>
                <p>Mix and match soups and rice, any type or combination, in the bulk quantity you need.</p>
              </li>
              <li className="step">
                <div className="step__head">
                  <span className="step__num">3</span>
                  <span className="step__icon" aria-hidden="true">🍳</span>
                </div>
                <h3>We cook fresh</h3>
                <p>Every order is home-cooked from scratch, in bulk, just for you.</p>
              </li>
              <li className="step">
                <div className="step__head">
                  <span className="step__num">4</span>
                  <span className="step__icon" aria-hidden="true">🚚</span>
                </div>
                <h3>Delivered to your door</h3>
                <p>Stocked, packed, and delivered exactly as requested — ready for your freezer.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="menu" id="menu">
          <div className="wrap">
            <h2 className="section-title">This month's menu</h2>
            <p className="section-sub">Pick any combination — every item is available in bulk.</p>

            {menuError && <p className="form-error">{menuError}</p>}

            <MenuGrid menu={menu} categories={categories} />
          </div>
        </section>

        <section className="order-cta" id="order">
          <div className="wrap order-cta__panel">
            <h2 className="section-title">Ready to build your order?</h2>
            <p className="section-sub" style={{ marginBottom: 28 }}>
              Pick your meals, set quantities, and check out in minutes.
            </p>
            <Link to="/order" className="btn btn--primary">Start ordering &rarr;</Link>
            <p className="order-cta__note">Next month's ordering window opens on the 1st.</p>
          </div>
        </section>

        <section className="why" id="why">
          <div className="wrap">
            <h2 className="section-title">Why choose us</h2>
            <div className="why__grid">
              <div className="why-card">
                <span className="why-card__icon">🗓️</span>
                <h3>Convenient monthly stock-up</h3>
                <p>One order a month covers you — no daily decisions about what's for dinner.</p>
              </div>
              <div className="why-card">
                <span className="why-card__icon">📦</span>
                <h3>Reliable bulk quantities</h3>
                <p>Ordered in the sizes that actually fill a freezer, not single portions.</p>
              </div>
              <div className="why-card">
                <span className="why-card__icon">🍳</span>
                <h3>Home-cooked quality</h3>
                <p>Made the way it's made at home — real ingredients, real technique.</p>
              </div>
              <div className="why-card">
                <span className="why-card__icon">🚚</span>
                <h3>Delivered fresh</h3>
                <p>Packed and delivered exactly as requested, ready to store.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-banner">
          <div className="wrap cta-banner__inner">
            <div>
              <h2>Ready to stock up?</h2>
              <p>Ordering opens on the 1st of every month.</p>
            </div>
            <Link to="/order" className="btn btn--onlight">Order now</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
