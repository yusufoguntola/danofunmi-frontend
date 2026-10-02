import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** React Router's BrowserRouter never resets scroll position on navigation —
 * it's all client-side DOM swaps within the same document, so a new page
 * mounts at whatever offset the previous one was left scrolled to (most
 * noticeable landing on a footer after navigating from a long page). Keyed
 * on pathname only, not search/hash, so query-param changes and in-page
 * anchor links keep their normal browser scroll behavior. Rendered once,
 * globally, in App.jsx. */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
