import { Star } from 'lucide-react';

/**
 * Compact "★★★★☆ (12)" rating summary for a medicine card. Renders nothing
 * when there's no review data — a medicine with zero reviews shows no
 * rating at all rather than an empty/zero-star row.
 */
const RatingStars = ({ average, count, size = 12 }) => {
  if (!count) return null;
  const rounded = Math.round(average);

  return (
    <div
      className="rating-stars"
      aria-label={`${average} out of 5 stars, based on ${count} review${count === 1 ? '' : 's'}`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} strokeWidth={2} fill={rounded >= n ? 'currentColor' : 'none'} aria-hidden="true" />
      ))}
      <span className="rating-count">({count})</span>
    </div>
  );
};

export default RatingStars;
