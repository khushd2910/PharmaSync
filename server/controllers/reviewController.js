/**
 * Medicine Reviews — CRUD.
 *
 * Same split as Module 8 (medicine_api) and Module 9 (chat): the actual
 * read/write against MongoDB lives in the Django service
 * (python-service/reviews), Node is just an authenticated proxy in front
 * of it. Node's job is to verify who's logged in (via `protect`) and
 * forward their identity — id, name, admin-ness — since the Django side
 * has no session system of its own and trusts whatever Node tells it.
 *
 * Exception: getBulkRatingSummaries below. That one powers the star
 * ratings shown on every medicine card across the storefront (home page,
 * discovery rows, wishlist, related products). If the Django service is
 * down — or just hasn't been started alongside Node — those requests
 * were failing silently and every card was rendering with no rating at
 * all. Since Node already holds a connection to the same shared MongoDB
 * database (reviews live in the same `reviews` collection either way),
 * this one read-only endpoint queries Mongo directly instead of proxying,
 * so card ratings don't depend on a second service being up. Everything
 * else (posting/editing/deleting a review, a single medicine's review
 * list) still goes through Django as before.
 */

const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const djangoAuthHeaders = require('../utils/djangoAuthHeaders');

const REVIEWS_API_URL = process.env.REVIEWS_API_URL || process.env.DJANGO_API_URL || 'http://localhost:8000';
const FETCH_TIMEOUT_MS = 5000;

const callDjango = (path, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  return fetch(`${REVIEWS_API_URL.replace(/\/$/, '')}${path}`, {
    headers: { 'Content-Type': 'application/json', ...djangoAuthHeaders() },
    signal: controller.signal,
    ...options,
  }).finally(() => clearTimeout(timeout));
};

const validateRatingInput = (body, next) => {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    next(new AppError('rating must be an integer between 1 and 5', 400));
    return null;
  }
  return { rating, comment: (body.comment || '').toString().trim() };
};

// @desc    List a medicine's reviews plus a rating summary
// @route   GET /api/medicines/:id/reviews
// @access  Public
const getMedicineReviews = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await callDjango(`/api/medicines/${req.params.id}/reviews`);
  } catch (err) {
    return next(new AppError('Reviews are temporarily unavailable', 502));
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return next(new AppError(data.error || 'Could not load reviews', upstream.status));
  }
  return res.status(200).json(data);
});

// @desc    Create a review for a medicine (one per user — re-reviewing
//          means editing the existing one via PUT instead)
// @route   POST /api/medicines/:id/reviews
// @access  Private
const createReview = catchAsync(async (req, res, next) => {
  const parsed = validateRatingInput(req.body, next);
  if (!parsed) return;

  let upstream;
  try {
    upstream = await callDjango(`/api/medicines/${req.params.id}/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        userId: req.user._id.toString(),
        userName: req.user.name,
        rating: parsed.rating,
        comment: parsed.comment,
      }),
    });
  } catch (err) {
    return next(new AppError('Reviews are temporarily unavailable', 502));
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return next(new AppError(data.error || 'Could not submit review', upstream.status));
  }
  return res.status(201).json(data);
});

// @desc    Edit your own review
// @route   PUT /api/reviews/:reviewId
// @access  Private (owner only — enforced on the Django side too)
const updateReview = catchAsync(async (req, res, next) => {
  const parsed = validateRatingInput(req.body, next);
  if (!parsed) return;

  let upstream;
  try {
    upstream = await callDjango(`/api/reviews/${req.params.reviewId}`, {
      method: 'PUT',
      body: JSON.stringify({
        userId: req.user._id.toString(),
        rating: parsed.rating,
        comment: parsed.comment,
      }),
    });
  } catch (err) {
    return next(new AppError('Reviews are temporarily unavailable', 502));
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return next(new AppError(data.error || 'Could not update review', upstream.status));
  }
  return res.status(200).json(data);
});

// @desc    Delete a review — the author, or an admin moderating content
// @route   DELETE /api/reviews/:reviewId
// @access  Private (owner or admin — enforced on the Django side too)
const deleteReview = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await callDjango(`/api/reviews/${req.params.reviewId}`, {
      method: 'DELETE',
      body: JSON.stringify({
        userId: req.user._id.toString(),
        isAdmin: req.user.role === 'admin',
      }),
    });
  } catch (err) {
    return next(new AppError('Reviews are temporarily unavailable', 502));
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return next(new AppError(data.error || 'Could not delete review', upstream.status));
  }
  return res.status(200).json(data);
});

// @desc    Bulk rating summary (count + average) for many medicines at
//          once — used by the storefront catalog/discovery rows so
//          showing stars on a card doesn't mean one request per card.
//          Medicines with no reviews are simply absent from the response.
// @route   GET /api/medicines/reviews/summary?ids=id1,id2,...
// @access  Public
const getBulkRatingSummaries = catchAsync(async (req, res, next) => {
  const ids = (req.query.ids || '').toString();
  const medicineIds = ids.split(',').map((id) => id.trim()).filter(Boolean);
  if (medicineIds.length === 0) {
    return res.status(200).json({ summaries: {} });
  }

  const pipeline = [
    { $match: { medicineId: { $in: medicineIds } } },
    { $group: { _id: '$medicineId', count: { $sum: 1 }, totalStars: { $sum: '$rating' } } },
  ];

  const rows = await mongoose.connection.db.collection('reviews').aggregate(pipeline).toArray();

  const summaries = {};
  for (const row of rows) {
    const count = row.count;
    summaries[row._id] = {
      count,
      average: count ? Math.round((row.totalStars / count) * 10) / 10 : 0,
    };
  }

  return res.status(200).json({ summaries });
});

module.exports = { getMedicineReviews, createReview, updateReview, deleteReview, getBulkRatingSummaries };
