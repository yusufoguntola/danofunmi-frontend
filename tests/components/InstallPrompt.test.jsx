import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallPrompt from '../../src/components/InstallPrompt';

const DISMISSED_KEY = 'pwa-install-dismissed';
const DEFAULT_UA = window.navigator.userAgent;

function stubMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function stubUserAgent(ua) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  stubMatchMedia(false);
  stubUserAgent(DEFAULT_UA);
});

afterEach(() => {
  stubUserAgent(DEFAULT_UA);
});

describe('InstallPrompt', () => {
  test('renders nothing when previously dismissed', () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when already running standalone (display-mode: standalone)', () => {
    stubMatchMedia(true);
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing on a plain non-iOS visit until beforeinstallprompt fires', () => {
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  test('shows the native install banner once beforeinstallprompt fires, and installs on click', async () => {
    const user = userEvent.setup();
    render(<InstallPrompt />);

    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = vi.fn();
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);

    expect(await screen.findByText('Install dánọ́fúnmi')).toBeInTheDocument();
    expect(screen.getByText('Add it to your home screen for quick access anytime.')).toBeInTheDocument();
    const installButton = screen.getByRole('button', { name: 'Install' });

    await user.click(installButton);

    expect(event.prompt).toHaveBeenCalled();
    await waitFor(() => expect(localStorage.getItem(DISMISSED_KEY)).toBe('1'));
    expect(screen.queryByText('Install dánọ́fúnmi')).not.toBeInTheDocument();
  });

  test('"Not now" dismisses the banner and sets the localStorage flag without prompting install', async () => {
    const user = userEvent.setup();
    render(<InstallPrompt />);

    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = vi.fn();
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);

    await user.click(await screen.findByRole('button', { name: 'Not now' }));

    expect(event.prompt).not.toHaveBeenCalled();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1');
    expect(screen.queryByText('Install dánọ́fúnmi')).not.toBeInTheDocument();
  });

  test('shows iOS-specific "Add to Home Screen" instructions (no Install button) on an iOS user agent', () => {
    stubUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');

    render(<InstallPrompt />);

    expect(screen.getByText('Tap Share, then "Add to Home Screen" for quick access.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  test('"Got it" on the iOS banner dismisses it and sets the localStorage flag', async () => {
    stubUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    const user = userEvent.setup();
    render(<InstallPrompt />);

    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1');
    expect(screen.queryByText('Install dánọ́fúnmi')).not.toBeInTheDocument();
  });
});
