const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export function formatNaira(amount) {
  return currencyFormatter.format(Number(amount) || 0);
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatStatus(status) {
  return String(status || '').replaceAll('_', ' ');
}

// 'YYYY-MM' (Order.orderMonth) -> 'October 2026' — mirrors the backend's
// own lib/orderSchedule.js monthLabel(), kept as a small separate copy since
// the frontend/backend can't share code across the split.
export function formatOrderMonth(orderMonth) {
  if (!orderMonth) return '—';
  const [year, month] = orderMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
}
