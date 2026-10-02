import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// App.jsx reads VITE_COMING_SOON at module-load time (`const COMING_SOON =
// import.meta.env.VITE_COMING_SOON === 'true'`), so each test needs
// vi.stubEnv + vi.resetModules + a fresh dynamic import — same pattern as
// tests/components/StagingBanner.test.jsx.
//
// These are light routing smoke tests only — "does the right top-level
// thing render" — not deep coverage of pages/components that have (or will
// have) their own test files.

vi.mock('../src/lib/api', () => ({
  api: {
    getMenu: vi.fn(() => new Promise(() => {})),
    getFeedback: vi.fn(() => new Promise(() => {})),
    getOrderSchedule: vi.fn(() => new Promise(() => {})),
    getInterestStatus: vi.fn(() => new Promise(() => {})),
  },
}));

vi.mock('../src/lib/db', () => ({
  db: { cart: { get: vi.fn(() => new Promise(() => {})) } },
}));

// The customer-chrome components are each independently tested (or, for
// ChatWidget, too heavy to mount for a routing smoke test) — stubbed here
// with a visible marker so this file can assert CustomerChrome's
// show/hide logic without depending on their own internals.
vi.mock('../src/components/chat/ChatWidget', () => ({ default: () => <div data-testid="chat-widget" /> }));
vi.mock('../src/components/InstallPrompt', () => ({ default: () => <div data-testid="install-prompt" /> }));
vi.mock('../src/components/MobileNav', () => ({ default: () => <div data-testid="mobile-nav" /> }));
vi.mock('../src/components/SessionWatcher', () => ({ default: () => null }));
vi.mock('../src/components/StagingBanner', () => ({ default: () => null }));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  // App.jsx renders the global ScrollToTop component, which calls this on
  // every route — jsdom doesn't implement it, so stub it to avoid noise.
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadApp() {
  const { default: App } = await import('../src/App');
  return App;
}

describe('App — customer routes (COMING_SOON=false)', () => {
  test('"/" renders the real landing page, not the coming-soon page', async () => {
    vi.stubEnv('VITE_COMING_SOON', 'false');
    const App = await loadApp();
    window.history.pushState({}, '', '/');

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/You choose/);
    expect(screen.queryByText(/The wait is/)).not.toBeInTheDocument();
  });

  test('customer chrome (install prompt / chat / mobile nav) is present on a customer route', async () => {
    vi.stubEnv('VITE_COMING_SOON', 'false');
    const App = await loadApp();
    window.history.pushState({}, '', '/');

    render(<App />);

    expect(await screen.findByTestId('chat-widget')).toBeInTheDocument();
    expect(screen.getByTestId('install-prompt')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
  });
});

describe('App — coming-soon gate (COMING_SOON=true)', () => {
  test('"/" renders ComingSoonPage instead of the landing page', async () => {
    vi.stubEnv('VITE_COMING_SOON', 'true');
    const App = await loadApp();
    window.history.pushState({}, '', '/');

    render(<App />);

    expect(await screen.findByText(/The wait is/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(/You choose/);
  });

  test('other customer routes (e.g. "/order") are also gated to ComingSoonPage', async () => {
    vi.stubEnv('VITE_COMING_SOON', 'true');
    const App = await loadApp();
    window.history.pushState({}, '', '/order');

    render(<App />);

    expect(await screen.findByText(/The wait is/)).toBeInTheDocument();
  });

  test('customer chrome is hidden while the coming-soon gate is up', async () => {
    vi.stubEnv('VITE_COMING_SOON', 'true');
    const App = await loadApp();
    window.history.pushState({}, '', '/');

    render(<App />);

    await screen.findByText(/The wait is/);
    expect(screen.queryByTestId('chat-widget')).not.toBeInTheDocument();
    expect(screen.queryByTestId('install-prompt')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();
  });

  test('admin routes remain reachable even behind the coming-soon gate', async () => {
    vi.stubEnv('VITE_COMING_SOON', 'true');
    const App = await loadApp();
    window.history.pushState({}, '', '/restricted-path/login');

    render(<App />);

    expect(await screen.findByText(/dánọ́fúnmi admin/)).toBeInTheDocument();
  });
});

describe('App — admin shell', () => {
  test('"/restricted-path/login" mounts the admin login screen', async () => {
    vi.stubEnv('VITE_COMING_SOON', 'false');
    const App = await loadApp();
    window.history.pushState({}, '', '/restricted-path/login');

    render(<App />);

    expect(await screen.findByText(/dánọ́fúnmi admin/)).toBeInTheDocument();
  });

  test('"/restricted-path" without a session redirects into the admin login shell, with customer chrome hidden', async () => {
    vi.stubEnv('VITE_COMING_SOON', 'false');
    const App = await loadApp();
    window.history.pushState({}, '', '/restricted-path');

    render(<App />);

    expect(await screen.findByText(/dánọ́fúnmi admin/)).toBeInTheDocument();
    expect(screen.queryByTestId('chat-widget')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();
  });
});
