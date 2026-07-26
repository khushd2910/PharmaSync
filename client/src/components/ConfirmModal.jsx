import { AlertTriangle } from 'lucide-react';

// Standardized "are you sure?" dialog — a consistent look for destructive
// actions across the app instead of the browser's plain window.confirm().
const ConfirmModal = ({ open, title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="confirm-modal-backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <AlertTriangle size={22} strokeWidth={2} className={danger ? 'confirm-modal-icon danger' : 'confirm-modal-icon'} />
        <h3>{title}</h3>
        <p className="muted-text">{message}</p>
        <div className="confirm-modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className={danger ? 'btn-secondary danger' : 'btn-primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
