import { api } from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Subscribes this browser to push and registers it with the backend.
 * `customerPhone` is optional — pass it once an order exists so status
 * updates for that order reach this device; omit it for a general
 * "notify me about new menus" opt-in. Resolves to false if unsupported,
 * denied, or misconfigured (no VAPID key set server-side). */
export async function subscribeToPush(customerPhone) {
  if (!pushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const { publicKey } = await api.getPushVapidKey();
  if (!publicKey) return false;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = subscription.toJSON();
  await api.subscribeToPush({ endpoint: json.endpoint, keys: json.keys, customerPhone: customerPhone || null });
  return true;
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await api.unsubscribeFromPush(subscription.endpoint);
  await subscription.unsubscribe();
}
