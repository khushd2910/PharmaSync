import './BrandLogo.css';

const BrandLogo = ({ compact = false, className = '' }) => (
  <span className={`brand-logo${compact ? ' brand-logo-compact' : ''} ${className}`.trim()}>
    <span className="brand-logo-icon" aria-hidden="true">
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="brandLogoTitle">
        <title id="brandLogoTitle">PharmaSync logo</title>
        <circle cx="32" cy="32" r="10" fill="currentColor" opacity="0.16" />
        <path d="M32 14L32 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 50L32 40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 32L24 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M50 32L40 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M19.5 19.5L26.5 26.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M44.5 44.5L37.5 37.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="16" r="4.5" fill="currentColor" />
        <circle cx="48" cy="16" r="4.5" fill="currentColor" />
        <circle cx="16" cy="48" r="4.5" fill="currentColor" />
        <circle cx="48" cy="48" r="4.5" fill="currentColor" />
      </svg>
    </span>
    <span className="brand-logo-text">
      <span className="brand-logo-title">PHARMA<span className="brand-logo-accent">SYNC</span></span>
      {!compact && <span className="brand-logo-subtitle">Integrated Life Sciences</span>}
    </span>
  </span>
);

export default BrandLogo;
