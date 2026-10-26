import { ORDERING_WINDOW, DELIVERY_WINDOW } from '../lib/orderTimeline';
import './OrderScheduleNotice.css';

/** The generic monthly ordering timeline (lib/orderTimeline.js), for the
 * header of any menu listing. */
export default function OrderScheduleNotice() {
  return (
    <p className="order-schedule-notice">
      📅 {ORDERING_WINDOW} {DELIVERY_WINDOW}
    </p>
  );
}
