import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PHONE_DISPLAY, INSTAGRAM_URL, whatsappLink } from '../../src/lib/contact';

// SiteFooter renders a real (unmocked) <StagingBanner>, whose module-level
// IS_STAGING const is read from import.meta.env at import time (see
// StagingBanner.jsx). This repo's local .env sets VITE_IS_STAGING=true, so a
// static import of SiteFooter would pick that up — vi.stubEnv + resetModules
// + a fresh dynamic import (the same technique as StagingBanner's own test)
// lets each test pin the flag deliberately instead of depending on .env.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function renderFooter({ initialEntries = ['/'], staging = 'false' } = {}) {
  vi.stubEnv('VITE_IS_STAGING', staging);
  const { default: SiteFooter } = await import('../../src/components/SiteFooter');
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SiteFooter />
    </MemoryRouter>
  );
}

describe('SiteFooter', () => {
  test('renders the brand, tagline, and copyright line', async () => {
    await renderFooter();

    expect(screen.getByText('dánọ́fúnmi')).toBeInTheDocument();
    expect(screen.getByText(/You choose, we cook\./)).toBeInTheDocument();
    expect(screen.getByText('© 2026 dánọ́fúnmi.')).toBeInTheDocument();
  });

  test('section links point at same-page #ids when already on the landing page', async () => {
    await renderFooter({ initialEntries: ['/'] });

    expect(screen.getByRole('link', { name: 'Menu' })).toHaveAttribute('href', '#menu');
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how');
    expect(screen.getByRole('link', { name: 'Why us' })).toHaveAttribute('href', '#why');
  });

  test('section links point back at the landing page\'s #ids from any other route', async () => {
    await renderFooter({ initialEntries: ['/order'] });

    expect(screen.getByRole('link', { name: 'Menu' })).toHaveAttribute('href', '/#menu');
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '/#how');
    expect(screen.getByRole('link', { name: 'Why us' })).toHaveAttribute('href', '/#why');
  });

  test('renders the static router links', async () => {
    await renderFooter();

    expect(screen.getByRole('link', { name: 'Order' })).toHaveAttribute('href', '/order');
    expect(screen.getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/orders');
    expect(screen.getByRole('link', { name: 'Leave feedback' })).toHaveAttribute('href', '/feedback');
  });

  test('renders the contact links from lib/contact.js', async () => {
    await renderFooter();

    expect(screen.getByRole('link', { name: /2347062845630/ })).toHaveAttribute('href', `tel:${PHONE_DISPLAY}`);

    const instagramLink = screen.getByRole('link', { name: /danofunmikitchen/ });
    expect(instagramLink).toHaveAttribute('href', INSTAGRAM_URL);
    expect(instagramLink).toHaveAttribute('target', '_blank');

    const whatsappAnchor = screen.getByRole('link', { name: /WhatsApp us/ });
    expect(whatsappAnchor).toHaveAttribute('href', whatsappLink("Hi, I'd like to place an order"));
    expect(whatsappAnchor).toHaveAttribute('target', '_blank');

    expect(screen.getByText(/Akobo, Ibadan/)).toBeInTheDocument();
  });

  test('renders no staging badge when VITE_IS_STAGING is not "true"', async () => {
    await renderFooter({ staging: 'false' });

    expect(screen.queryByText('🚧 Staging')).not.toBeInTheDocument();
  });

  test('renders the footer-variant staging badge when VITE_IS_STAGING is "true"', async () => {
    await renderFooter({ staging: 'true' });

    expect(screen.getByText('🚧 Staging')).toHaveClass('staging-banner--footer');
  });
});
