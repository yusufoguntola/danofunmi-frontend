import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

// CLIENT_ID is read from import.meta.env at module-load time (this repo's
// local .env sets VITE_GOOGLE_CLIENT_ID to a real value), so each test needs
// vi.stubEnv + vi.resetModules + a fresh dynamic import — same technique as
// StagingBanner's test — to pin the "configured" vs. "unset" branch
// deliberately instead of depending on .env.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.google;
  // loadGoogleScript() reuses an existing <script src="..."> tag if one is
  // already in the document — clean up between tests so each one gets a
  // fresh "script not loaded yet" state.
  document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`).forEach((s) => s.remove());
});

describe('GoogleSignInButton', () => {
  test('renders nothing when VITE_GOOGLE_CLIENT_ID is unset', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const { default: GoogleSignInButton } = await import('../../src/components/GoogleSignInButton');

    const { container } = render(<GoogleSignInButton onCredential={() => {}} />);

    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector(`script[src="${SCRIPT_SRC}"]`)).toBeNull();
  });

  test('loads the GSI script and calls initialize/renderButton once it loads, when configured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
    const { default: GoogleSignInButton } = await import('../../src/components/GoogleSignInButton');
    const initialize = vi.fn();
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton } } };

    render(<GoogleSignInButton onCredential={() => {}} />);

    const script = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    expect(script).toBeTruthy();
    script.onload();

    await vi.waitFor(() => expect(initialize).toHaveBeenCalled());
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id', callback: expect.any(Function) })
    );
    expect(renderButton).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      theme: 'outline',
      size: 'large',
    }));
  });

  test('invoking the stored callback with a GSI response forwards the credential to onCredential', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
    const { default: GoogleSignInButton } = await import('../../src/components/GoogleSignInButton');
    const initialize = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton: vi.fn() } } };
    const onCredential = vi.fn();

    render(<GoogleSignInButton onCredential={onCredential} />);
    document.querySelector(`script[src="${SCRIPT_SRC}"]`).onload();
    await vi.waitFor(() => expect(initialize).toHaveBeenCalled());

    const { callback } = initialize.mock.calls[0][0];
    callback({ credential: 'raw-jwt-credential' });

    expect(onCredential).toHaveBeenCalledWith('raw-jwt-credential');
  });
});
