/**
 * Shared visual shell for every auth screen — a clean, quiet card with a
 * thin brand-colored top edge, so Login/Register/Admin/Reset all read as
 * one consistent system without decorative noise.
 */
const AuthCard = ({ eyebrow, title, subtitle, children, admin = false }) => {
  return (
    <div className={`auth-page ${admin ? 'admin-theme' : ''}`}>
      <div className="auth-card">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
};

export default AuthCard;
