import { Link, useLocation } from 'react-router-dom';
import LogoMark from './LogoMark';
import { PHONE_DISPLAY, INSTAGRAM_HANDLE, INSTAGRAM_URL, whatsappLink } from '../lib/contact';
import './SiteFooter.css';

export default function SiteFooter() {
  const { pathname } = useLocation();
  const onLanding = pathname === '/';
  const sectionHref = (id) => (onLanding ? `#${id}` : `/#${id}`);

  return (
    <footer className="footer" id="contact">
      <div className="wrap footer__inner">
        <div className="footer__brand">
          <Link className="logo logo--footer" to="/">
            <LogoMark size={28} />
            dánọ́fúnmi
          </Link>
          <p>You choose, we cook.<br />Home-cooked, just for you.</p>
        </div>

        <div className="footer__col">
          <h4>Explore</h4>
          <a href={sectionHref('menu')}>Menu</a>
          <a href={sectionHref('how')}>How it works</a>
          <a href={sectionHref('why')}>Why us</a>
          <Link to="/order">Order</Link>
          <Link to="/orders">My orders</Link>
        </div>

        <div className="footer__col">
          <h4>Contact</h4>
          <a href={`tel:${PHONE_DISPLAY}`}>📞 {PHONE_DISPLAY}</a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">📷 @{INSTAGRAM_HANDLE}</a>
          <a href={whatsappLink("Hi, I'd like to place an order")} target="_blank" rel="noreferrer">
            💬 WhatsApp us
          </a>
          <span>📍 Akobo, Ibadan</span>
        </div>
      </div>
      <div className="wrap footer__legal">
        <span>&copy; 2026 dánọ́fúnmi.</span>
      </div>
    </footer>
  );
}
