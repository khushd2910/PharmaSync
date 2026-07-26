// Centralized formatting so every page renders money/dates the same way,
// instead of ad-hoc `₹${x.toFixed(2)}` and mixed toLocaleDateString calls
// scattered across components.

export const formatCurrency = (amount) => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return 'Price unavailable';
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Short date — order lists, timestamps: "27 Jul 2026"
export const formatDate = (input) => {
  if (!input) return '—';
  return new Date(input).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Date + time — "last run", audit-style timestamps: "27 Jul 2026, 3:45 PM"
export const formatDateTime = (input) => {
  if (!input) return '—';
  return new Date(input).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};
