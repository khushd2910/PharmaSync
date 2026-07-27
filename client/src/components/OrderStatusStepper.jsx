import { useEffect, useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { ORDER_STAGES, computeDisplayStatus } from '../utils/orderStatus';

/**
 * Renders the 5-stage delivery stepper and keeps itself live while the
 * order isn't yet Delivered — it ticks every few seconds so someone
 * watching the tracking page sees it progress without refreshing.
 */
const OrderStatusStepper = ({ order }) => {
  const [status, setStatus] = useState(() => computeDisplayStatus(order));

  useEffect(() => {
    if (status === 'Delivered' || status === 'Cancelled' || order.demoMode === false) return;
    const interval = setInterval(() => setStatus(computeDisplayStatus(order)), 3000);
    return () => clearInterval(interval);
  }, [order, status]);

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
