const { body, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// Runs after any validator chain below; turns validation failures into a
// single clean AppError instead of express-validator's raw error array
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((e) => e.msg)
      .join('. ');
    return next(new AppError(message, 400));
  }
  next();
};

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
  body('phone').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Enter a valid phone number'),
];

const loginRules = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordRules = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email').normalizeEmail(),
];

const resetPasswordRules = [
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
];

const addMedicineRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('price').notEmpty().withMessage('Price is required').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock').notEmpty().withMessage('Quantity is required').isInt({ min: 0 }).withMessage('Quantity must be a whole number, 0 or more'),
  body('brand').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('category').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('manufacturer').optional({ checkFalsy: true }).trim().isLength({ max: 150 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('expiryDate').optional({ checkFalsy: true }).isISO8601().withMessage('Expiry must be a valid date'),
  body('requiresPrescription').optional().isBoolean().withMessage('Prescription Required must be true or false'),
  body('barcode').optional({ checkFalsy: true }).trim().isLength({ max: 64 }).withMessage('Barcode is too long'),
];

const updateMedicineRules = [
  body('name').optional({ checkFalsy: true }).trim().isLength({ max: 150 }),
  body('price').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Quantity must be a whole number, 0 or more'),
  body('brand').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('category').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('manufacturer').optional({ checkFalsy: true }).trim().isLength({ max: 150 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('expiryDate').optional({ checkFalsy: true }).isISO8601().withMessage('Expiry must be a valid date'),
  body('requiresPrescription').optional().isBoolean().withMessage('Prescription Required must be true or false'),
  body('isDiscontinued').optional().isBoolean().withMessage('isDiscontinued must be true or false'),
  body('barcode').optional({ checkFalsy: true }).trim().isLength({ max: 64 }).withMessage('Barcode is too long'),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  addMedicineRules,
  updateMedicineRules,
};
