import { useEffect, useState } from 'react';
import { Star, Pencil, Trash2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/format';
import ConfirmModal from './ConfirmModal';

const StarPicker = ({ value, onChange, disabled }) => (
  <div className="review-star-picker">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        className="star-btn"
        onClick={() => onChange(n)}
        disabled={disabled}
        aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
      >
        <Star size={20} strokeWidth={2} fill={value >= n ? 'currentColor' : 'none'} />
      </button>
    ))}
  </div>
);

const StarDisplay = ({ value }) => (
  <div className="review-star-display" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={14} strokeWidth={2} fill={value >= n ? 'currentColor' : 'none'} />
    ))}
  </div>
);

const MedicineReviews = ({ medicineId }) => {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ count: 0, average: 0, distribution: {} });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const loadReviews = () => {
    if (!medicineId) return;
    let cancelled = false;
    setLoading(true);

    api
      .get(`/medicines/${medicineId}/reviews`)
      .then((res) => {
        if (cancelled) return;
        setReviews(res.data.reviews || []);
        setSummary(res.data.summary || { count: 0, average: 0, distribution: {} });
      })
      .catch(() => {
        if (!cancelled) {
          setReviews([]);
          setSummary({ count: 0, average: 0, distribution: {} });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    const cleanup = loadReviews();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicineId]);

  const myReview = user ? reviews.find((r) => r.userId === user.id) : null;

  const openAddForm = () => {
    if (!user) {
      showToast('Please log in to write a review', 'info');
      navigate('/login');
      return;
    }
    setFormRating(0);
    setFormComment('');
    setFormOpen(true);
  };

  const openEditForm = (review) => {
    setFormRating(review.rating);
    setFormComment(review.comment || '');
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formRating < 1) {
      showToast('Please select a star rating', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (myReview) {
        await api.put(`/reviews/${myReview.id}`, { rating: formRating, comment: formComment });
        showToast('Your review was updated', 'success');
      } else {
        await api.post(`/medicines/${medicineId}/reviews`, { rating: formRating, comment: formComment });
        showToast('Thanks for your review!', 'success');
      }
      setFormOpen(false);
      loadReviews();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save your review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!reviewToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/reviews/${reviewToDelete.id}`);
      showToast('Review deleted', 'success');
      setReviewToDelete(null);
      loadReviews();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete review', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (review) => user && (review.userId === user.id || user.role === 'admin');
  const canEdit = (review) => user && review.userId === user.id;

  return (
    <div className="detail-section reviews-section">
      <div className="reviews-header">
        <h3>Ratings & Reviews</h3>
        {!formOpen && !myReview && (
          <button type="button" className="btn-secondary" onClick={openAddForm}>
            Write a review
          </button>
        )}
      </div>

      {summary.count > 0 && (
        <div className="reviews-summary">
          <span className="reviews-summary-average num">{summary.average.toFixed(1)}</span>
          <div>
            <StarDisplay value={Math.round(summary.average)} />
            <p className="muted-text">
              Based on {summary.count} review{summary.count === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      )}

      {formOpen && (
        <form className="review-form" onSubmit={handleSubmit}>
          <StarPicker value={formRating} onChange={setFormRating} disabled={submitting} />
          <textarea
            className="review-form-textarea"
            placeholder="Share your experience with this medicine (optional)"
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
            maxLength={1000}
            rows={3}
            disabled={submitting}
          />
          <div className="review-form-actions">
            <button type="button" className="btn-secondary ghost" onClick={closeForm} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : myReview ? 'Update Review' : 'Submit Review'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted-text">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="muted-text">No reviews yet — be the first to share your experience.</p>
      ) : (
        <ul className="reviews-list">
          {reviews.map((review) => (
            <li key={review.id} className="review-item">
              <div className="review-item-top">
                <div>
                  <span className="review-author">{review.userName}</span>
                  <StarDisplay value={review.rating} />
                </div>
                <span className="muted-text review-date">{formatDate(review.createdAt)}</span>
              </div>
              {review.comment && <p className="review-comment">{review.comment}</p>}
              {(canEdit(review) || canDelete(review)) && (
                <div className="review-item-actions">
                  {canEdit(review) && (
                    <button type="button" className="link-muted review-action-btn" onClick={() => openEditForm(review)}>
                      <Pencil size={12} strokeWidth={2} /> Edit
                    </button>
                  )}
                  {canDelete(review) && (
                    <button
                      type="button"
                      className="link-muted review-action-btn danger"
                      onClick={() => setReviewToDelete(review)}
                    >
                      <Trash2 size={12} strokeWidth={2} /> Delete
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={!!reviewToDelete}
        title="Delete this review?"
        message="This can't be undone."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={confirmDelete}
        onCancel={() => setReviewToDelete(null)}
      />
    </div>
  );
};

export default MedicineReviews;
