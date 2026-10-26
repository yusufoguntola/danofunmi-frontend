import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const orderHistory = [];
const TIMELINE = {
  opensOn: '2026-10-25',
  closesOn: '2026-11-13',
  deliveryStartsOn: '2026-11-16',
  deliveryEndsOn: '2026-11-18',
};
let timeline = TIMELINE;

vi.mock('../../src/lib/api', () => ({
  api: { getOrderTimeline: async () => timeline },
}));
vi.mock('../../src/lib/db', () => ({
  db: {
    orderHistory: {
      filter: (fn) => ({ count: async () => orderHistory.filter(fn).length }),
    },
  },
}));

// ALWAYS_SHOW is computed once at module-load time from import.meta.env, so
// each test stubs the env and dynamically imports a fresh copy (same pattern
// as StagingBanner.test.jsx).
async function renderFlyer({ dev = false, staging = 'false' } = {}) {
  vi.stubEnv('DEV', dev);
  vi.stubEnv('VITE_IS_STAGING', staging);
  const { default: OrderWindowFlyer } = await import('../../src/components/OrderWindowFlyer');
  const result = render(
    <MemoryRouter>
      <OrderWindowFlyer />
    </MemoryRouter>,
  );
  // Visibility waits on the async timeline fetch and order-history check.
  await new Promise((r) => setTimeout(r, 0));
  return result;
}

const DISMISSED_KEY = 'order-flyer-dismissed-on';

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  orderHistory.length = 0;
  timeline = TIMELINE;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 26));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('OrderWindowFlyer (production)', () => {
  test('shows the ordering and delivery dates to a new visitor', async () => {
    await renderFlyer();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('November orders open')).toBeInTheDocument();
    expect(screen.getByText(/submit your order before ordering closes/i)).toBeInTheDocument();
    expect(screen.getByText('25th of October')).toBeInTheDocument();
    expect(screen.getByText('13th of November')).toBeInTheDocument();
    expect(screen.getByText('16th – 18th of November')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /order now/i })).toHaveAttribute('href', '/order');
  });

  test('the close button hides it and remembers today as the dismissal date', async () => {
    const user = userEvent.setup();
    await renderFlyer();
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('2026-10-26');
  });

  test('Escape does not close it', async () => {
    const user = userEvent.setup();
    await renderFlyer();
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('clicking the backdrop does not close it', async () => {
    const user = userEvent.setup();
    const { container } = await renderFlyer();
    await screen.findByRole('dialog');
    await user.click(container.querySelector('.order-flyer__backdrop'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('renders nothing when already closed today', async () => {
    localStorage.setItem(DISMISSED_KEY, '2026-10-26');
    const { container } = await renderFlyer();
    expect(container).toBeEmptyDOMElement();
  });

  test('comes back the day after it was closed', async () => {
    localStorage.setItem(DISMISSED_KEY, '2026-10-25');
    await renderFlyer();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  test('renders nothing once an order has been placed this month', async () => {
    orderHistory.push({ orderId: 'o1', createdAt: new Date(2026, 9, 25, 12).toISOString() });
    const { container } = await renderFlyer();
    expect(container).toBeEmptyDOMElement();
  });

  test('still shows when the only orders predate this month\'s window', async () => {
    orderHistory.push({ orderId: 'o0', createdAt: new Date(2026, 8, 30).toISOString() });
    await renderFlyer();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  test('uses whatever dates admin has set', async () => {
    timeline = { opensOn: '2026-10-20', closesOn: '2026-11-30', deliveryStartsOn: '2026-12-01', deliveryEndsOn: '2026-12-03' };
    await renderFlyer();
    expect(await screen.findByText('December orders open')).toBeInTheDocument();
    expect(screen.getByText('20th of October')).toBeInTheDocument();
    expect(screen.getByText('30th of November')).toBeInTheDocument();
    expect(screen.getByText('1st – 3rd of December')).toBeInTheDocument();
  });

  test('renders nothing when no timeline is set', async () => {
    timeline = null;
    const { container } = await renderFlyer();
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing before ordering opens', async () => {
    vi.setSystemTime(new Date(2026, 9, 24, 23, 59));
    const { container } = await renderFlyer();
    expect(container).toBeEmptyDOMElement();
  });

  test('still shows on the closing day itself', async () => {
    vi.setSystemTime(new Date(2026, 10, 13, 23, 0));
    await renderFlyer();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  test('renders nothing after ordering closes', async () => {
    vi.setSystemTime(new Date(2026, 10, 14, 0, 0, 1));
    const { container } = await renderFlyer();
    expect(container).toBeEmptyDOMElement();
  });
});

describe.each([
  ['local dev', { dev: true }],
  ['staging', { staging: 'true' }],
])('OrderWindowFlyer (%s)', (_label, env) => {
  test('shows even after being closed today or ordering this month', async () => {
    localStorage.setItem(DISMISSED_KEY, '2026-10-26');
    orderHistory.push({ orderId: 'o1', createdAt: new Date(2026, 9, 26).toISOString() });
    await renderFlyer(env);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('shows even after ordering closes', async () => {
    vi.setSystemTime(new Date(2026, 11, 1));
    await renderFlyer(env);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('the close button still hides it', async () => {
    const user = userEvent.setup();
    await renderFlyer(env);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
