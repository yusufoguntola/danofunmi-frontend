import { useEffect, useState } from 'react';
import './InstallPrompt.css';

const DISMISSED_KEY = 'pwa-install-dismissed';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return;

    if (isIos()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="install-prompt" role="status">
      <div className="install-prompt__text">
        <strong>Install dánọ́fúnmi</strong>
        <span>
          {iosHint
            ? 'Tap Share, then "Add to Home Screen" for quick access.'
            : 'Add it to your home screen for quick access anytime.'}
        </span>
      </div>
      <div className="install-prompt__actions">
        {!iosHint && (
          <button type="button" className="btn btn--onlight btn--small" onClick={install}>
            Install
          </button>
        )}
        <button type="button" className="btn btn--small install-prompt__dismiss" onClick={dismiss}>
          {iosHint ? 'Got it' : 'Not now'}
        </button>
      </div>
    </div>
  );
}
