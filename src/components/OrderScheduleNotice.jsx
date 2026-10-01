import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import './OrderScheduleNotice.css';

/** Today's monthly-ordering cutoff status (lib/orderSchedule.js on the
 * backend), self-fetched so this drops into any page without each one
 * managing its own copy of the same date math. Renders nothing until the
 * fetch resolves — this is supplementary copy, not worth a loading state. */
export default function OrderScheduleNotice() {
  const [schedule, setSchedule] = useState(null);

  useEffect(() => {
    api.getOrderSchedule().then(setSchedule).catch(() => {});
  }, []);

  if (!schedule) return null;

  const { itemCutoffDay, comboCutoffDay, itemOrderMonthLabel, comboOrderMonthLabel } = schedule;
  const comboClosedForThisMonth = itemOrderMonthLabel !== comboOrderMonthLabel;

  return (
    <p className="order-schedule-notice">
      {!comboClosedForThisMonth ? (
        <>
          📅 Order individual items on or before the {itemCutoffDay}th, combo deals on or before the{' '}
          {comboCutoffDay}th, for <strong>{itemOrderMonthLabel}</strong> delivery.
        </>
      ) : (
        <>
          ⏰ Combo deals are now batched for <strong>{comboOrderMonthLabel}</strong> — the {comboCutoffDay}th cutoff
          has passed. Individual items ordered on or before the {itemCutoffDay}th still go out in{' '}
          <strong>{itemOrderMonthLabel}</strong>.
        </>
      )}
    </p>
  );
}
