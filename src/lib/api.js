const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

console.log("Base Url:", BASE_URL);

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, token, isForm = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

export const api = {
  BASE_URL,
  getMenu: () => request('/api/menu'),
  getPaymentInfo: () => request('/api/payment-info'),
  getLocations: () => request('/api/locations'),
  createOrder: (payload, token) => request('/api/orders', { method: 'POST', body: payload, token }),
  getOrder: (idOrNarration) => request(`/api/orders/${encodeURIComponent(idOrNarration)}`),
  uploadReceipt: (orderId, file) => {
    const form = new FormData();
    form.append('receipt', file);
    return request(`/api/orders/${orderId}/receipt`, { method: 'POST', body: form, isForm: true });
  },
  submitPaymentDetails: (orderId, { senderName, senderBank }) =>
    request(`/api/orders/${orderId}/receipt`, { method: 'POST', body: { senderName, senderBank } }),

  adminLogin: (email, password) =>
    request('/api/admin/login', { method: 'POST', body: { email, password } }),

  adminListOrders: (token, status) =>
    request(`/api/orders/admin/all${status ? `?status=${status}` : ''}`, { token }),
  adminUpdateOrderStatus: (token, orderId, status) =>
    request(`/api/orders/admin/${orderId}/status`, { method: 'PATCH', body: { status }, token }),
  adminUpdateReceiptStatus: (token, orderId, receiptId, status) =>
    request(`/api/orders/admin/${orderId}/receipts/${receiptId}`, {
      method: 'PATCH',
      body: { status },
      token,
    }),

  adminListMenu: (token) => request('/api/menu/admin/all', { token }),
  adminGetMenuItem: (token, id) => request(`/api/menu/admin/${id}`, { token }),
  adminCreateMenuItem: (token, payload) =>
    request('/api/menu/admin', { method: 'POST', body: payload, token }),
  adminUpdateMenuItem: (token, id, payload) =>
    request(`/api/menu/admin/${id}`, { method: 'PATCH', body: payload, token }),
  adminDeleteMenuItem: (token, id) => request(`/api/menu/admin/${id}`, { method: 'DELETE', token }),
  adminAddMenuOption: (token, itemId, payload) =>
    request(`/api/menu/admin/${itemId}/options`, { method: 'POST', body: payload, token }),
  adminUpdateMenuOption: (token, optionId, payload) =>
    request(`/api/menu/admin/options/${optionId}`, { method: 'PATCH', body: payload, token }),
  adminDeleteMenuOption: (token, optionId) =>
    request(`/api/menu/admin/options/${optionId}`, { method: 'DELETE', token }),

  adminListCategories: (token) => request('/api/menu/admin/categories', { token }),
  adminCreateCategory: (token, payload) =>
    request('/api/menu/admin/categories', { method: 'POST', body: payload, token }),
  adminUpdateCategory: (token, id, payload) =>
    request(`/api/menu/admin/categories/${id}`, { method: 'PATCH', body: payload, token }),
  adminDeleteCategory: (token, id) =>
    request(`/api/menu/admin/categories/${id}`, { method: 'DELETE', token }),

  adminUploadMenuIcon: (token, file) => {
    const form = new FormData();
    form.append('icon', file);
    return request('/api/menu/admin/icons/upload', { method: 'POST', body: form, isForm: true, token });
  },
  adminGenerateMenuIcon: (token, payload) =>
    request('/api/menu/admin/icons/generate', { method: 'POST', body: payload, token }),

  adminListLocations: (token) => request('/api/locations/admin/all', { token }),
  adminCreateLocation: (token, payload) =>
    request('/api/locations/admin', { method: 'POST', body: payload, token }),
  adminUpdateLocation: (token, id, payload) =>
    request(`/api/locations/admin/${id}`, { method: 'PATCH', body: payload, token }),

  adminListCosts: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/admin/costs${qs ? `?${qs}` : ''}`, { token });
  },
  adminCreateCost: (token, payload) =>
    request('/api/admin/costs', { method: 'POST', body: payload, token }),
  adminDeleteCost: (token, id) => request(`/api/admin/costs/${id}`, { method: 'DELETE', token }),

  adminGetPnl: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/admin/reports/pnl${qs ? `?${qs}` : ''}`, { token });
  },

  adminListFeedback: (token) => request('/api/admin/feedback', { token }),

  sendChatMessage: (messages, token) => request('/api/chat', { method: 'POST', body: { messages }, token }),

  customerSignup: ({ name, email, phone, password, recaptchaToken }) =>
    request('/api/customer/signup', { method: 'POST', body: { name, email, phone, password, recaptchaToken } }),
  customerLogin: (identifier, password, recaptchaToken) =>
    request('/api/customer/login', { method: 'POST', body: { identifier, password, recaptchaToken } }),
  customerGoogleLogin: (credential) =>
    request('/api/customer/google', { method: 'POST', body: { credential } }),
  getCustomerOrders: (token) => request('/api/customer/orders', { token }),

  getPushVapidKey: () => request('/api/push/vapid-public-key'),
  subscribeToPush: (payload) => request('/api/push/subscribe', { method: 'POST', body: payload }),
  unsubscribeFromPush: (endpoint) => request('/api/push/unsubscribe', { method: 'POST', body: { endpoint } }),

  adminListPushSubscriptions: (token) => request('/api/push/admin/subscriptions', { token }),
  adminSendBroadcast: (token, payload) =>
    request('/api/push/admin/broadcast', { method: 'POST', body: payload, token }),
};

export { ApiError };
