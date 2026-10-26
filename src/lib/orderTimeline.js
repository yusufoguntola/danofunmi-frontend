// The generic monthly ordering timeline, shown site-wide instead of specific
// dates so the copy never goes stale from one month to the next.
export const ORDERING_WINDOW =
  'Ordering opens in the last week of every month and closes in the second week of the following month.';

export const DELIVERY_WINDOW = 'Delivery begins shortly after ordering closes.';

// The admin-set dates for the current run (GET /api/order-timeline — see
// backend/src/lib/orderTimeline.js) arrive as 'YYYY-MM-DD' calendar days.
// These mirror that file's formatting, so the site and the confirmation
// emails word the same dates the same way.

/** 'YYYY-MM-DD' -> local midnight on that day. */
export function parseTimelineDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function ordinalDay(day) {
  if (day % 10 === 1 && day !== 11) return `${day}st`;
  if (day % 10 === 2 && day !== 12) return `${day}nd`;
  if (day % 10 === 3 && day !== 13) return `${day}rd`;
  return `${day}th`;
}

function monthName(value) {
  return parseTimelineDate(value).toLocaleDateString('en-NG', { month: 'long' });
}

/** '2026-11-16' -> '16th of November'. */
export function formatTimelineDate(value) {
  return `${ordinalDay(parseTimelineDate(value).getDate())} of ${monthName(value)}`;
}

/** '16th – 18th of November', or '30th of November – 2nd of December' across
 * two months, or just '16th of November' for a single day. */
export function formatDeliveryRange({ deliveryStartsOn, deliveryEndsOn }) {
  if (deliveryStartsOn === deliveryEndsOn) return formatTimelineDate(deliveryStartsOn);
  if (deliveryStartsOn.slice(0, 7) === deliveryEndsOn.slice(0, 7)) {
    return `${ordinalDay(parseTimelineDate(deliveryStartsOn).getDate())} – ${formatTimelineDate(deliveryEndsOn)}`;
  }
  return `${formatTimelineDate(deliveryStartsOn)} – ${formatTimelineDate(deliveryEndsOn)}`;
}

/** The month a run is named for — the one it's delivered in, e.g. 'November'. */
export function timelineMonthLabel({ deliveryStartsOn }) {
  return monthName(deliveryStartsOn);
}
