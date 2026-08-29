import { useEffect, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;
function loadGoogleScript() {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
      if (existing) return resolve();
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** Renders Google's own "Sign in with Google" button. Renders nothing if
 * VITE_GOOGLE_CLIENT_ID isn't configured. */
export default function GoogleSignInButton({ onCredential }) {
  const ref = useRef(null);
  // Kept current via a ref rather than in the effect's dependency array, so
  // initialize()/renderButton() run once per mount instead of re-running (and
  // spamming Google's "initialize() called multiple times" warning) every
  // time the parent passes a new onCredential function reference.
  const onCredentialRef = useRef(onCredential);
  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript().then(() => {
      if (cancelled || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => onCredentialRef.current(response.credential),
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!CLIENT_ID) return null;
  return <div ref={ref} />;
}
