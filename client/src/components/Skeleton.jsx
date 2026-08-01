// Shared skeleton-loading primitives — a handful of small building blocks
// instead of every page inventing its own "Loading…" text or hand-rolled
// placeholder markup. Compose these into page-specific shapes rather than
// adding new one-off skeleton components per page.

/** A single pulsing block. Pass width/height (any CSS length) and optional radius. */
export const SkeletonBlock = ({ width = '100%', height = 16, radius = 6, style, className = '' }) => (
  <span
    className={`skeleton-block ${className}`}
    style={{ width, height, borderRadius: radius, ...style }}
    aria-hidden="true"
  />
);

/** A run of skeleton text lines, e.g. for a paragraph or card body. */
export const SkeletonText = ({ lines = 3, lastLineWidth = '60%' }) => (
  <div className="skeleton-text-block" aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonBlock key={i} height={12} width={i === lines - 1 ? lastLineWidth : '100%'} />
    ))}
  </div>
);

/** Placeholder shaped like a MedicineCard — image + a couple of text lines. */
export const SkeletonMedicineCard = () => (
  <div className="skeleton-medicine-card" aria-hidden="true">
    <SkeletonBlock height={140} radius={12} />
    <SkeletonBlock height={12} width="40%" style={{ marginTop: 10 }} />
    <SkeletonBlock height={14} width="80%" style={{ marginTop: 6 }} />
    <SkeletonBlock height={11} width="55%" style={{ marginTop: 6 }} />
  </div>
);

/** A row of SkeletonMedicineCards — mirrors MedicineRow / the catalog grid while data loads. */
export const SkeletonMedicineRow = ({ count = 4 }) => (
  <div className="skeleton-medicine-row">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonMedicineCard key={i} />
    ))}
  </div>
);

/** Placeholder for a simple list row (orders, addresses, prescriptions…). */
export const SkeletonListRow = () => (
  <div className="skeleton-list-row" aria-hidden="true">
    <SkeletonBlock height={14} width="45%" />
    <SkeletonBlock height={11} width="30%" style={{ marginTop: 8 }} />
  </div>
);

export default SkeletonBlock;
