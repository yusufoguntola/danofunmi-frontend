import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { pushSupported, subscribeToPush, unsubscribeFromPush } from '../../src/lib/push';
import { api } from '../../src/lib/api';

vi.mock('../../src/lib/api', () => ({
  api: {
    getPushVapidKey: vi.fn(),
    subscribeToPush: vi.fn(),
    unsubscribeFromPush: vi.fn(),
  },
}));

// A realistic VAPID public key shape (base64url, no padding) — exercises the
// module's internal urlBase64ToUint8Array without throwing on atob.
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa40HI0DLLuxazjieKlLxkIO5pNQZS3rlNSlLDQ7B64K1W1W3wQZpbsL2WKVbE';

function installBrowserPushApis({ permission = 'granted', existingSubscription = null } = {}) {
  const subscription = {
    endpoint: 'https://push.example/sub/abc',
    keys: { p256dh: 'p-key', auth: 'a-key' },
    toJSON() {
      return { endpoint: this.endpoint, keys: this.keys };
    },
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(existingSubscription),
    subscribe: vi.fn().mockResolvedValue(subscription),
  };
  const registration = { pushManager };

  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
  window.PushManager = function PushManager() {};
  window.Notification = {
    permission,
    requestPermission: vi.fn().mockResolvedValue(permission),
  };

  return { subscription, pushManager, registration };
}

function removeBrowserPushApis() {
  delete navigator.serviceWorker;
  delete window.PushManager;
  delete window.Notification;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  removeBrowserPushApis();
});

describe('pushSupported', () => {
  test('false when serviceWorker/PushManager/Notification are not all present', () => {
    expect(pushSupported()).toBe(false);
  });

  test('true once serviceWorker, PushManager and Notification are all present', () => {
    installBrowserPushApis();
    expect(pushSupported()).toBe(true);
  });
});

describe('subscribeToPush', () => {
  test('resolves false without touching the API when push is unsupported', async () => {
    const result = await subscribeToPush('08011112222');
    expect(result).toBe(false);
    expect(api.getPushVapidKey).not.toHaveBeenCalled();
  });

  test('resolves false when notification permission is denied', async () => {
    installBrowserPushApis({ permission: 'denied' });

    const result = await subscribeToPush();

    expect(result).toBe(false);
    expect(api.getPushVapidKey).not.toHaveBeenCalled();
  });

  test('resolves false when the server has no VAPID key configured', async () => {
    installBrowserPushApis();
    api.getPushVapidKey.mockResolvedValue({ publicKey: null });

    const result = await subscribeToPush();

    expect(result).toBe(false);
    expect(api.subscribeToPush).not.toHaveBeenCalled();
  });

  test('subscribes fresh (no existing subscription) and registers it with the backend', async () => {
    const { pushManager } = installBrowserPushApis({ existingSubscription: null });
    api.getPushVapidKey.mockResolvedValue({ publicKey: VAPID_PUBLIC_KEY });

    const result = await subscribeToPush('08011112222');

    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    );
    expect(api.subscribeToPush).toHaveBeenCalledWith({
      endpoint: 'https://push.example/sub/abc',
      keys: { p256dh: 'p-key', auth: 'a-key' },
      customerPhone: '08011112222',
    });
    expect(result).toBe(true);
  });

  test('reuses an existing subscription instead of creating a new one', async () => {
    const existingSubscription = {
      endpoint: 'https://push.example/sub/existing',
      keys: { p256dh: 'p2', auth: 'a2' },
      toJSON() {
        return { endpoint: this.endpoint, keys: this.keys };
      },
    };
    const { pushManager } = installBrowserPushApis({ existingSubscription });
    api.getPushVapidKey.mockResolvedValue({ publicKey: VAPID_PUBLIC_KEY });

    const result = await subscribeToPush();

    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(api.subscribeToPush).toHaveBeenCalledWith({
      endpoint: 'https://push.example/sub/existing',
      keys: { p256dh: 'p2', auth: 'a2' },
      customerPhone: null,
    });
    expect(result).toBe(true);
  });

  test('omits customerPhone (sends null) when none is passed', async () => {
    installBrowserPushApis();
    api.getPushVapidKey.mockResolvedValue({ publicKey: VAPID_PUBLIC_KEY });

    await subscribeToPush();

    expect(api.subscribeToPush).toHaveBeenCalledWith(
      expect.objectContaining({ customerPhone: null })
    );
  });
});

describe('unsubscribeFromPush', () => {
  test('no-ops when push is unsupported', async () => {
    await unsubscribeFromPush();
    expect(api.unsubscribeFromPush).not.toHaveBeenCalled();
  });

  test('no-ops when there is no active subscription', async () => {
    installBrowserPushApis({ existingSubscription: null });

    await unsubscribeFromPush();

    expect(api.unsubscribeFromPush).not.toHaveBeenCalled();
  });

  test('unsubscribes from the backend and the browser when a subscription exists', async () => {
    const activeSubscription = {
      endpoint: 'https://push.example/sub/active',
      unsubscribe: vi.fn().mockResolvedValue(true),
    };
    installBrowserPushApis({ existingSubscription: activeSubscription });

    await unsubscribeFromPush();

    expect(api.unsubscribeFromPush).toHaveBeenCalledWith(activeSubscription.endpoint);
    expect(activeSubscription.unsubscribe).toHaveBeenCalled();
  });
});
