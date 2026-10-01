import './StagingBanner.css';

// A no-op everywhere except an explicitly-flagged staging deployment — set
// VITE_IS_STAGING=true in that environment's own .env (left unset/false in
// local dev and production), same pattern as VITE_COMING_SOON in App.jsx.
const IS_STAGING = import.meta.env.VITE_IS_STAGING === 'true';

/** Small "Staging" indicator so nobody mistakes the staging deployment for
 * production (or vice versa) — one instance rendered globally above
 * everything in App.jsx (covers the header area on every route, admin
 * included), another inline in SiteFooter. `variant` only changes layout
 * (full-width bar vs. an inline badge), not the staging check itself. */
export default function StagingBanner({ variant = 'top' }) {
  if (!IS_STAGING) return null;
  return <div className={`staging-banner staging-banner--${variant}`}>🚧 Staging</div>;
}
