import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

// IS_STAGING is computed once at module-load time from import.meta.env (see
// source comment), so each test needs vi.stubEnv + vi.resetModules + a fresh
// dynamic import — a static top-level import would freeze in whatever env
// happened to be active first (this repo's local .env sets
// VITE_IS_STAGING=true for dev convenience).
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('StagingBanner', () => {
  test('renders nothing when VITE_IS_STAGING is any value other than "true"', async () => {
    vi.stubEnv('VITE_IS_STAGING', 'false');
    const { default: StagingBanner } = await import('../../src/components/StagingBanner');

    const { container } = render(<StagingBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  test('renders the banner when VITE_IS_STAGING is "true"', async () => {
    vi.stubEnv('VITE_IS_STAGING', 'true');
    const { default: StagingBanner } = await import('../../src/components/StagingBanner');

    const { getByText } = render(<StagingBanner />);

    expect(getByText('🚧 Staging')).toBeInTheDocument();
  });

  test('defaults to the "top" variant class', async () => {
    vi.stubEnv('VITE_IS_STAGING', 'true');
    const { default: StagingBanner } = await import('../../src/components/StagingBanner');

    const { getByText } = render(<StagingBanner />);

    expect(getByText('🚧 Staging')).toHaveClass('staging-banner--top');
  });

  test('respects a passed variant prop for the layout class', async () => {
    vi.stubEnv('VITE_IS_STAGING', 'true');
    const { default: StagingBanner } = await import('../../src/components/StagingBanner');

    const { getByText } = render(<StagingBanner variant="inline" />);

    expect(getByText('🚧 Staging')).toHaveClass('staging-banner--inline');
  });
});
