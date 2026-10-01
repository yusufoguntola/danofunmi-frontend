import {obfuscationEnabled, obfuscatePayload, deobfuscatePayload} from './payloadObfuscation';
import {emitSessionExpired} from './sessionEvents';
import {tokenType} from './jwt';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

console.log("Base Url:", BASE_URL);

class ApiError extends Error {
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

async function request(path, {method = 'GET', body, token, isForm = false} = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    // Payload obfuscation never wraps multipart uploads — just JSON bodies.
    const useObfuscation = obfuscationEnabled && !isForm;

    let outgoing;
    if (isForm) {
        outgoing = body;
    } else if (body !== undefined) {
        const json = JSON.stringify(body);
        outgoing = useObfuscation ? JSON.stringify({data: await obfuscatePayload(json)}) : json;
        headers['Content-Type'] = 'application/json';
    }
    // Sent on every request (bodyless GETs included) so the server knows to
    // wrap the response too.
    if (useObfuscation) headers['X-Encrypted'] = '1';

    // Express sends an ETag on every res.json() but no Cache-Control, and
    // the browser's default fetch caching is happy to serve a stale GET
    // without a network round trip at all. This is a live API, never a
    // cache — though note this only governs the *browser's* HTTP cache:
    // the service worker's own stale-while-revalidate cache for
    // GET /api/orders/:id (see sw.js) sits in front of this and isn't
    // affected by the fetch options here at all — see bustOrderCache below.
    const res = await fetch(`${BASE_URL}${path}`, {method, headers, body: outgoing, cache: 'no-store'});

    let text = await res.text();
    if (text && res.headers.get('X-Encrypted') === '1') {
        try {
            text = await deobfuscatePayload(JSON.parse(text).data);
        } catch {
            throw new ApiError('Could not read server response', res.status, null);
        }
    }
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            // A non-JSON body means something other than this app answered —
            // a proxy's own error page (e.g. nginx rejecting an oversized
            // upload before it ever reaches Express), a timeout, etc. Still
            // surface it as an ApiError so callers' `instanceof ApiError`
            // checks work and show their own specific message instead of a
            // generic "please try again" from an unhandled parse failure.
            throw new ApiError(`Request failed (${res.status})`, res.status, null);
        }
    }

    if (!res.ok) {
        // A 401 on a request that carried a token means that token is dead —
        // tell the app so it can sign the user out (see SessionWatcher).
        if (res.status === 401 && token) emitSessionExpired(tokenType(token));
        throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
    }
    return data;
}

// sw.js caches GET /api/orders/:id with a stale-while-revalidate strategy —
// deliberately, so an order renders instantly on a weak connection and
// refreshes quietly in the background. That's wrong immediately after *this*
// tab itself just changed the order (cancelling it, uploading a receipt,
// submitting payment details): the very next getOrder() would otherwise be
// served the pre-mutation snapshot, since stale-while-revalidate answers
// from cache first and only updates it for *next* time. Call this right
// after such a mutation succeeds, before reading the order back, so that
// next read is a genuine network fetch. Best-effort/no-op wherever the Cache
// API or a service worker isn't available (SSR, unsupported browser, or the
// SW hasn't taken control yet) — those environments were never serving a
// stale cached response in the first place.
async function bustOrderCache(idOrNarration) {
    if (!('caches' in window)) return;
    try {
        const cache = await caches.open('dfm-api-cache');
        await cache.delete(`${BASE_URL}/api/orders/${encodeURIComponent(idOrNarration)}`);
    } catch {
        // best-effort
    }
}

export const api = {
    BASE_URL,
    getMenu: () => request('/api/menu'),
    getFeedback: () => request('/api/feedback'),
    getOrderFeedback: (idOrNarration) => request(`/api/feedback/order/${encodeURIComponent(idOrNarration)}`),
    submitOrderFeedback: (idOrNarration, {rating, comment}) =>
        request(`/api/feedback/order/${encodeURIComponent(idOrNarration)}`, {method: 'POST', body: {rating, comment}}),
    submitGeneralFeedback: ({rating, comment, customerName, location, foodType, recaptchaToken}) =>
        request('/api/feedback/general', {
            method: 'POST',
            body: {rating, comment, customerName, location, foodType, recaptchaToken},
        }),
    registerInterest: (payload) => request('/api/interest', {method: 'POST', body: payload}),
    getInterestStatus: () => request('/api/interest/status'),
    getPaymentInfo: () => request('/api/payment-info'),
    getLocations: () => request('/api/locations'),
    createOrder: (payload, token) => request('/api/orders', {method: 'POST', body: payload, token}),
    getOrder: (idOrNarration) => request(`/api/orders/${encodeURIComponent(idOrNarration)}`),
    getOrderSchedule: () => request('/api/orders/schedule'),
    uploadReceipt: (orderId, file) => {
        const form = new FormData();
        form.append('receipt', file);
        return request(`/api/orders/${orderId}/receipt`, {method: 'POST', body: form, isForm: true});
    },
    submitPaymentDetails: (orderId, {senderName, senderBank}) =>
        request(`/api/orders/${orderId}/receipt`, {method: 'POST', body: {senderName, senderBank}}),
    cancelOrder: (orderId) => request(`/api/orders/${orderId}/cancel`, {method: 'PATCH'}),

    adminLogin: (email, password) =>
        request('/api/admin/login', {method: 'POST', body: {email, password}}),

    adminListOrders: (token, status, month) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (month) params.set('month', month);
        const qs = params.toString();
        return request(`/api/orders/admin/all${qs ? `?${qs}` : ''}`, {token});
    },
    adminGetOrderMonths: (token) => request('/api/orders/admin/months', {token}),
    adminUpdateOrderStatus: (token, orderId, status, riderContact) =>
        request(`/api/orders/admin/${orderId}/status`, {
            method: 'PATCH',
            body: riderContact !== undefined ? {status, riderContact} : {status},
            token,
        }),
    adminUpdateOrderLocation: (token, orderId, locationId) =>
        request(`/api/orders/admin/${orderId}/location`, {method: 'PATCH', body: {locationId}, token}),
    adminUpdateOrderMonth: (token, orderId, orderMonth) =>
        request(`/api/orders/admin/${orderId}/month`, {method: 'PATCH', body: {orderMonth}, token}),
    adminUpdateReceiptStatus: (token, orderId, receiptId, status) =>
        request(`/api/orders/admin/${orderId}/receipts/${receiptId}`, {
            method: 'PATCH',
            body: {status},
            token,
        }),

    adminListMenu: (token) => request('/api/menu/admin/all', {token}),
    adminGetMenuItem: (token, id) => request(`/api/menu/admin/${id}`, {token}),
    adminCreateMenuItem: (token, payload) =>
        request('/api/menu/admin', {method: 'POST', body: payload, token}),
    adminUpdateMenuItem: (token, id, payload) =>
        request(`/api/menu/admin/${id}`, {method: 'PATCH', body: payload, token}),
    adminDeleteMenuItem: (token, id) => request(`/api/menu/admin/${id}`, {method: 'DELETE', token}),
    adminAddMenuOption: (token, itemId, payload) =>
        request(`/api/menu/admin/${itemId}/options`, {method: 'POST', body: payload, token}),
    adminUpdateMenuOption: (token, optionId, payload) =>
        request(`/api/menu/admin/options/${optionId}`, {method: 'PATCH', body: payload, token}),
    adminDeleteMenuOption: (token, optionId) =>
        request(`/api/menu/admin/options/${optionId}`, {method: 'DELETE', token}),

    adminListCategories: (token) => request('/api/menu/admin/categories', {token}),
    adminCreateCategory: (token, payload) =>
        request('/api/menu/admin/categories', {method: 'POST', body: payload, token}),
    adminUpdateCategory: (token, id, payload) =>
        request(`/api/menu/admin/categories/${id}`, {method: 'PATCH', body: payload, token}),
    adminDeleteCategory: (token, id) =>
        request(`/api/menu/admin/categories/${id}`, {method: 'DELETE', token}),

    adminListGroups: (token) => request('/api/menu/admin/groups/all', {token}),
    adminGetGroup: (token, id) => request(`/api/menu/admin/groups/${id}`, {token}),
    adminCreateGroup: (token, payload) =>
        request('/api/menu/admin/groups', {method: 'POST', body: payload, token}),
    adminUpdateGroup: (token, id, payload) =>
        request(`/api/menu/admin/groups/${id}`, {method: 'PATCH', body: payload, token}),
    adminDeleteGroup: (token, id) => request(`/api/menu/admin/groups/${id}`, {method: 'DELETE', token}),
    adminAddGroupItem: (token, groupId, payload) =>
        request(`/api/menu/admin/groups/${groupId}/items`, {method: 'POST', body: payload, token}),
    adminUpdateGroupItem: (token, itemId, payload) =>
        request(`/api/menu/admin/groups/items/${itemId}`, {method: 'PATCH', body: payload, token}),
    adminDeleteGroupItem: (token, itemId) =>
        request(`/api/menu/admin/groups/items/${itemId}`, {method: 'DELETE', token}),

    adminUploadMenuIcon: (token, file) => {
        const form = new FormData();
        form.append('icon', file);
        return request('/api/menu/admin/icons/upload', {method: 'POST', body: form, isForm: true, token});
    },
    adminGenerateMenuIcon: (token, payload) =>
        request('/api/menu/admin/icons/generate', {method: 'POST', body: payload, token}),

    adminListCustomers: (token) => request('/api/admin/customers', {token}),
    adminGetCustomer: (token, id) => request(`/api/admin/customers/${id}`, {token}),

    adminListLocations: (token) => request('/api/locations/admin/all', {token}),
    adminCreateLocation: (token, payload) =>
        request('/api/locations/admin', {method: 'POST', body: payload, token}),
    adminUpdateLocation: (token, id, payload) =>
        request(`/api/locations/admin/${id}`, {method: 'PATCH', body: payload, token}),

    adminListCosts: (token, params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/api/admin/costs${qs ? `?${qs}` : ''}`, {token});
    },
    adminCreateCost: (token, payload) =>
        request('/api/admin/costs', {method: 'POST', body: payload, token}),
    adminDeleteCost: (token, id) => request(`/api/admin/costs/${id}`, {method: 'DELETE', token}),

    adminGetPnl: (token, params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/api/admin/reports/pnl${qs ? `?${qs}` : ''}`, {token});
    },

    adminListFeedback: (token) => request('/api/admin/feedback', {token}),
    adminDeleteFeedback: (token, id) => request(`/api/admin/feedback/${id}`, {method: 'DELETE', token}),
    adminSetFeedbackVisibility: (token, id, visibleOnLanding) =>
        request(`/api/admin/feedback/${id}`, {method: 'PATCH', body: {visibleOnLanding}, token}),

    adminListErrorLogs: (token) => request('/api/admin/error-logs', {token}),
    adminDeleteErrorLog: (token, id) => request(`/api/admin/error-logs/${id}`, {method: 'DELETE', token}),
    adminClearErrorLogs: (token) => request('/api/admin/error-logs', {method: 'DELETE', token}),

    adminListRequests: (token) => request('/api/admin/requests', {token}),
    adminRequestsUnreadCount: (token) => request('/api/admin/requests/unread-count', {token}),
    adminMarkAllRequestsRead: (token) => request('/api/admin/requests/read-all', {method: 'PATCH', token}),
    adminMarkRequestRead: (token, id, read = true) =>
        request(`/api/admin/requests/${id}`, {method: 'PATCH', body: {read}, token}),
    adminDeleteRequest: (token, id) => request(`/api/admin/requests/${id}`, {method: 'DELETE', token}),
    adminSuggestRequestItems: (token, id) =>
        request(`/api/admin/requests/${id}/suggest-items`, {method: 'POST', token}),
    adminCreateOrderFromRequest: (token, id, payload) =>
        request(`/api/admin/requests/${id}/create-order`, {method: 'POST', body: payload, token}),

    adminListInterest: (token) => request('/api/admin/interest', {token}),
    adminInterestUnreadCount: (token) => request('/api/admin/interest/unread-count', {token}),
    adminMarkAllInterestRead: (token) => request('/api/admin/interest/read-all', {method: 'PATCH', token}),
    adminMarkInterestRead: (token, id, read = true) =>
        request(`/api/admin/interest/${id}`, {method: 'PATCH', body: {read}, token}),
    adminGetInterestSettings: (token) => request('/api/admin/interest/settings', {token}),
    adminUpdateInterestSettings: (token, firstTasteSlots) =>
        request('/api/admin/interest/settings', {method: 'PATCH', body: {firstTasteSlots}, token}),
    // Shortlisting (true) with a locationId pushes the registration straight
    // into the ordering flow server-side — see backend/src/routes/interest.js.
    adminSetInterestShortlisted: (token, id, shortlisted, locationId) =>
        request(`/api/admin/interest/${id}`, {
            method: 'PATCH',
            body: locationId ? {shortlisted, locationId} : {shortlisted},
            token,
        }),
    adminSetInterestClaimedSlot: (token, id, claimedSlot) =>
        request(`/api/admin/interest/${id}`, {method: 'PATCH', body: {claimedSlot}, token}),
    adminSendShortlistEmails: (token) =>
        request('/api/admin/interest/send-shortlist-emails', {method: 'POST', token}),
    adminCreateFirstTasteOrder: (token, id, locationId) =>
        request(`/api/admin/interest/${id}/create-order`, {method: 'POST', body: {locationId}, token}),
    adminDeleteInterest: (token, id) => request(`/api/admin/interest/${id}`, {method: 'DELETE', token}),

    sendChatMessage: (messages, token) => request('/api/chat', {method: 'POST', body: {messages}, token}),

    customerSignup: ({name, email, phone, password, recaptchaToken}) =>
        request('/api/customer/signup', {method: 'POST', body: {name, email, phone, password, recaptchaToken}}),
    customerLogin: (identifier, password, recaptchaToken) =>
        request('/api/customer/login', {method: 'POST', body: {identifier, password, recaptchaToken}}),
    customerGoogleLogin: (credential) =>
        request('/api/customer/google', {method: 'POST', body: {credential}}),
    getCustomerOrders: (token) => request('/api/customer/orders', {token}),
    getCustomerProfile: (token) => request('/api/customer/me', {token}),

    getPushVapidKey: () => request('/api/push/vapid-public-key'),
    subscribeToPush: (payload) => request('/api/push/subscribe', {method: 'POST', body: payload}),
    unsubscribeFromPush: (endpoint) => request('/api/push/unsubscribe', {method: 'POST', body: {endpoint}}),

    adminListPushSubscriptions: (token) => request('/api/push/admin/subscriptions', {token}),
    // payload: { channels: ['in_app', 'email'], title, body }
    adminSendBroadcast: (token, payload) =>
        request('/api/admin/broadcast', {method: 'POST', body: payload, token}),
};

export {ApiError, bustOrderCache};
