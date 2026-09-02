import { api } from '../lib/api';

const IMAGE_ICON_RE = /^(\/uploads\/|https?:\/\/)/;

/** Renders a menu item/combo `icon` field, which is either an emoji/text glyph or an uploaded image path. */
export default function MenuIcon({ icon, className = '', imgClassName = '' }) {
  const isImage = typeof icon === 'string' && IMAGE_ICON_RE.test(icon);
  if (isImage) {
    const src = icon.startsWith('http') ? icon : `${api.BASE_URL}${icon}`;
    return <img src={src} alt="" className={imgClassName || className} />;
  }
  return <span className={className}>{icon}</span>;
}
