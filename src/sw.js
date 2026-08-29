import { clientsClaim } from 'workbox-core';
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

self.skipWaiting();
clientsClaim();

const manifest = self.__WB_MANIFEST;
precacheAndRoute(manifest);

// SPA client-side routing: serve the shell for any navigation not otherwise
// handled, so deep links like /order/:id work offline too — except API and
// upload requests, which must hit the network (or the API cache rule below).
// Skipped when there's nothing precached (dev mode, where __WB_MANIFEST is
// empty): createHandlerBoundToURL throws for a URL that isn't a precache
// key, and Vite's own dev server already serves the SPA shell for any
// unmatched navigation, so there's nothing to add here anyway.
if (manifest && manifest.length > 0) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('index.html'), {
      denylist: [/^\/api/, /^\/uploads/],
    })
  );
}

// Menu, delivery locations, and single-order lookups render instantly from
// cache on a weak connection and refresh quietly in the background.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const apiOrigin = new URL(API_BASE_URL).origin;

registerRoute(
  ({ url }) =>
    url.origin === apiOrigin &&
    (url.pathname === '/api/menu' ||
      url.pathname === '/api/locations' ||
      /^\/api\/orders\/[^/]+$/.test(url.pathname)),
  new StaleWhileRevalidate({ cacheName: 'dfm-api-cache' })
);

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'dánọ́fúnmi', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'dánọ́fúnmi', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((c) => new URL(c.url).pathname === url);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
