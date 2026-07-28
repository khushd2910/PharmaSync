import { Check, Circle } from 'lucide-react';
import { ORDER_STAGES, computeDisplayStatus } from '../utils/orderStatus';

/**
 * Renders the 5-stage delivery stepper. The status only ever changes when
 * an admin updates the order (or the user cancels it), both of which
 * refetch the order from the server — so this simply renders whatever
 * status the current `order` prop reflects, with no client-side ticking.
 */
const OrderStatusStepper = ({ order }) => {
  const status = computeDisplayStatus(order);

  if (status === 'Cancelled') {
    return <div className="badge badge-cancelled">Order Cancelled</div>;
  }

  const currentIndex = ORDER_STAGES.indexOf(status);

  return (
    <div className="status-stepper">
      {ORDER_STAGES.map((stage, i) => (
        <div key={stage} className={`status-step ${i <= currentIndex ? 'done' : ''} ${i === currentIndex ? 'current' : ''}`}>
          <div className="status-step-dot">
            {i < currentIndex ? <Check size={13} strokeWidth={3} /> : <Circle size={9} fill={i === currentIndex ? 'currentColor' : 'none'} />}
          </div>
          <span className="status-step-label">{stage}</span>
          {i < ORDER_STAGES.length - 1 && <div className={`status-step-line ${i < currentIndex ? 'done' : ''}`} />}
        </div>
      ))}
    </div>
  );
};

export default OrderStatusStepper;
