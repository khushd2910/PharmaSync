/**
 * Shared visual shell for every auth screen: a "prescription pad" card with
 * a perforated top edge, so Login/Register/Admin/Reset all feel like one
 * consistent, distinctive system rather than generic forms.
 */
const AuthCard = ({ eyebrow, title, subtitle, children, admin = false }) => {
  return (
    <div className={`auth-page ${admin ? 'admin-theme' : ''}`}>
      <div className="auth-card">
        <div className="perforation" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
        {eyebrow && <p className="auth-eyebrow">{eyebrow}</p>}
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
};

export default AuthCard;
