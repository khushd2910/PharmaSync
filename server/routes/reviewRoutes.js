const express = require('express');
const router = express.Router();
const { updateReview, deleteReview } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

// Editing/deleting a specific review is keyed by the review's own id, not
// the medicine's — mounted separately from medicineRoutes for that reason.
// Ownership (and the owner-or-admin check for delete) is enforced by the
// Django reviews service itself, using the identity reviewController forwards.
router.put('/:reviewId', protect, updateReview);
router.delete('/:reviewId', protect, deleteReview);

module.exports = router;
