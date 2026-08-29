const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const SCRIPT_SRC = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;

let scriptPromise = null;
function loadScript() {
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

/** Gets a reCAPTCHA v3 token for the given action, or null if
 * VITE_RECAPTCHA_SITE_KEY isn't configured — callers just omit the token in
 * that case, and the backend skips verification the same way. */
export async function getRecaptchaToken(action) {
  if (!SITE_KEY) return null;
  await loadScript();
  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha.execute(SITE_KEY, { action }).then(resolve, reject);
    });
  });
}
