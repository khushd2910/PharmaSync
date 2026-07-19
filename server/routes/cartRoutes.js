const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
} = require('../controllers/cartController');

router.use(protect); // every cart route requires login

router.get('/', getCart);
router.post('/items', addItem);
router.patch('/items/:medicineId', updateItemQuantity);
router.delete('/items/:medicineId', removeItem);
router.delete('/', clearCart);

module.exports = router;
