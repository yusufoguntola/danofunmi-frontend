/**
 * The dánọ́fúnmi brand mark — one pot portioned into many bowls, the bulk-order
 * model drawn as an emblem. Self-contained (own dark-green circular badge), so
 * it reads on light or dark page backgrounds alike.
 */
export default function LogoMark({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="32" cy="32" r="32" fill="#16321f" />
      <circle cx="32" cy="32" r="31" fill="none" stroke="#e6f1e3" strokeWidth="1" opacity="0.35" />
      <line x1="32" y1="32" x2="52" y2="32" stroke="#e6f1e3" strokeWidth="1" opacity="0.5" />
      <line x1="32" y1="32" x2="42" y2="49.3" stroke="#e6f1e3" strokeWidth="1" opacity="0.5" />
      <line x1="32" y1="32" x2="22" y2="49.3" stroke="#e6f1e3" strokeWidth="1" opacity="0.5" />
      <line x1="32" y1="32" x2="12" y2="32" stroke="#e6f1e3" strokeWidth="1" opacity="0.5" />
      <line x1="32" y1="32" x2="22" y2="14.7" stroke="#e6f1e3" strokeWidth="1" opacity="0.5" />
      <line x1="32" y1="32" x2="42" y2="14.7" stroke="#e6f1e3" strokeWidth="1" opacity="0.5" />
      <circle cx="52" cy="32" r="5" fill="#16321f" stroke="#faf6ec" strokeWidth="1.8" />
      <circle cx="52" cy="32" r="1.8" fill="#c4652f" />
      <circle cx="42" cy="49.3" r="5" fill="#16321f" stroke="#faf6ec" strokeWidth="1.8" />
      <circle cx="42" cy="49.3" r="1.8" fill="#c4652f" />
      <circle cx="22" cy="49.3" r="5" fill="#16321f" stroke="#faf6ec" strokeWidth="1.8" />
      <circle cx="22" cy="49.3" r="1.8" fill="#c4652f" />
      <circle cx="12" cy="32" r="5" fill="#16321f" stroke="#faf6ec" strokeWidth="1.8" />
      <circle cx="12" cy="32" r="1.8" fill="#c4652f" />
      <circle cx="22" cy="14.7" r="5" fill="#16321f" stroke="#faf6ec" strokeWidth="1.8" />
      <circle cx="22" cy="14.7" r="1.8" fill="#c4652f" />
      <circle cx="42" cy="14.7" r="5" fill="#16321f" stroke="#faf6ec" strokeWidth="1.8" />
      <circle cx="42" cy="14.7" r="1.8" fill="#c4652f" />
      <circle cx="32" cy="32" r="12" fill="#faf6ec" />
      <circle cx="32" cy="32" r="7.5" fill="#c4652f" />
    </svg>
  );
}
