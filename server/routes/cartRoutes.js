const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  saveItemForLater,
  moveSavedItemToCart,
  removeSavedItem,
  clearCart,
} = require('../controllers/cartController');

router.use(protect); // every cart route requires login

router.get('/', getCart);
router.post('/items', addItem);
router.patch('/items/:medicineId', updateItemQuantity);
router.delete('/items/:medicineId', removeItem);
router.post('/items/:medicineId/save', saveItemForLater);
router.post('/saved/:medicineId/move-back', moveSavedItemToCart);
router.delete('/saved/:medicineId', removeSavedItem);
router.delete('/', clearCart);

module.exports = router;
