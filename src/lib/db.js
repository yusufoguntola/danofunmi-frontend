import Dexie from 'dexie';

// Client-side app data (conversation history, in-progress cart) lives in
// IndexedDB via Dexie instead of localStorage — handles larger payloads
// better and survives longer. Purely-cosmetic UI flags (e.g. "install
// banner dismissed") stay in localStorage; they aren't app data.
export const db = new Dexie('danofunmiDB');

db.version(1).stores({
  chat: 'id',
  cart: 'id',
});

// orderHistory: device-local record of orders actually placed from this
// browser (cart checkout or chat) — powers the "My Orders" page. There are
// no customer accounts, so this deliberately isn't a server-side list.
db.version(2).stores({
  chat: 'id',
  cart: 'id',
  orderHistory: 'orderId',
});
