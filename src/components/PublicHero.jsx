import { Link } from 'react-router-dom';
import LogoMark from './LogoMark';
import './PublicHero.css';

/** Minimal top header (just the logo, linking home) shared by simple public
 * pages that don't need OrderStatusPage's fuller hero (back link, etc.) —
 * currently FeedbackPage and GeneralFeedbackPage. */
export default function PublicHero() {
  return (
    <header className="public-hero">
      <div className="wrap">
        <Link className="public-hero__logo" to="/">
          <LogoMark size={28} />
          dánọ́fúnmi
        </Link>
      </div>
    </header>
  );
}
