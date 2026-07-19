const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
<<<<<<< HEAD
=======
const { updateProfile } = require('../controllers/userController');
>>>>>>> master

// @desc  User dashboard (placeholder - later modules will add real data:
//        cart, orders, medicine listing, etc.)
// @route GET /api/user/dashboard
// @access Private (logged-in users)
router.get('/dashboard', protect, (req, res) => {
  res.status(200).json({
    message: `Welcome ${req.user.name}`,
<<<<<<< HEAD
    info: 'You can shop medicines from here (coming in Module 2).',
=======
    info: 'You can shop medicines from here.',
>>>>>>> master
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

<<<<<<< HEAD
=======
// @desc  Update the logged-in user's own profile (name, phone, address)
// @route PATCH /api/user/profile
// @access Private
router.patch('/profile', protect, updateProfile);

>>>>>>> master
module.exports = router;
