const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  rateOrder,
  downloadInvoice,
} = require('../controllers/orderController');

router.use(protect); // every order route requires login

router.post('/', createOrder);
router.get('/', getMyOrders);
router.get('/:id', getOrderById);
router.patch('/:id/cancel', cancelOrder);
router.patch('/:id/rating', rateOrder);
router.get('/:id/invoice', downloadInvoice);

module.exports = router;
