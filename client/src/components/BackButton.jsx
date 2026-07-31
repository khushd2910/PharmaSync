import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// A persistent "Back" button in the top right corner of the viewport.
// Falls back to a sensible page if the browser history is not available.
const BackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/') return null;

  const handleBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) {
      navigate(-1);
      return;
    }

    if (location.pathname.startsWith('/orders/')) {
      navigate('/orders');
      return;
    }

    navigate('/');
  };

  return (
    <button
      type="button"
      className="global-back-btn"
      onClick={handleBack}
      aria-label="Go back"
      title="Go back"
    >
      <ArrowLeft size={16} strokeWidth={2.2} /> Back
    </button>
  );
};

export default BackButton;
