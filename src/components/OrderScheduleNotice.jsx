import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  ORDERING_WINDOW,
  DELIVERY_WINDOW,
  formatTimelineDate,
  formatDeliveryRange,
} from '../lib/orderTimeline';
import './OrderScheduleNotice.css';

/** The monthly ordering timeline, for the header of any menu listing. By
 * default the generic wording (lib/orderTimeline.js); with `exact`, the
 * current run's actual dates from the admin-set timeline (GET
 * /api/order-timeline) — falling back to the generic wording if none is set
 * or the fetch fails, and rendering nothing until it settles so the copy
 * doesn't visibly swap. */
export default function OrderScheduleNotice({ exact = false }) {
  const [timeline, setTimeline] = useState(undefined);

  useEffect(() => {
    if (!exact) return;
    let cancelled = false;
    api
      .getOrderTimeline()
      .catch(() => null)
      .then((t) => {
        if (!cancelled) setTimeline(t);
      });
    return () => {
      cancelled = true;
    };
  }, [exact]);

  if (exact && timeline === undefined) return null;

  return (
    <p className="order-schedule-notice">
      {exact && timeline ? (
        <>
          📅 Ordering opens <strong>{formatTimelineDate(timeline.opensOn)}</strong> and closes{' '}
          <strong>{formatTimelineDate(timeline.closesOn)}</strong>. Delivery:{' '}
          <strong>{formatDeliveryRange(timeline)}</strong>.
        </>
      ) : (
        <>
          📅 {ORDERING_WINDOW} {DELIVERY_WINDOW}
        </>
      )}
    </p>
  );
}
