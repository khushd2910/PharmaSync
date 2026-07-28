import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// A persistent "Back" button, docked to the right edge of the viewport.
// It uses the browser's own history (navigate(-1)), which ScrollManager
// recognizes as a POP navigation and restores the exact scroll position
// the previous page was at — not just the top of it.
const BackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Nothing to go back to from the very first page of this session, and no
  // point offering it on the homepage itself.
  const canGoBack = (window.history.state?.idx ?? 0) > 0;
  if (location.pathname === '/' || !canGoBack) return null;

  return (
    <button
      type="button"
      className="global-back-btn"
      onClick={() => navigate(-1)}
      aria-label="Go back"
      title="Go back"
    >
      <ArrowLeft size={18} strokeWidth={2.2} />
    </button>
  );
};

export default BackButton;
