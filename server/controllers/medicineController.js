const Medicine = require('../models/Medicine');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const SORT_OPTIONS = {
  relevance: { score: { $meta: 'textScore' } },
  name: { name: 1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
};

// @desc    List/search medicines with pagination — publicly accessible so
//          guests can browse before creating an account
// @route   GET /api/medicines?search=&page=&limit=&sort=
// @access  Public
const listMedicines = catchAsync(async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const sortKey = SORT_OPTIONS[req.query.sort] ? req.query.sort : search ? 'relevance' : 'name';

  const filter = { isDiscontinued: { $ne: true } };
  let projection = null;

  if (search) {
    filter.$text = { $search: search };
    projection = { score: { $meta: 'textScore' } };
  }

  const [medicines, total] = await Promise.all([
    Medicine.find(filter, projection)
      .sort(SORT_OPTIONS[sortKey])
      .skip((page - 1) * limit)
      .limit(limit),
    Medicine.countDocuments(filter),
  ]);

  return res.status(200).json({
    medicines,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// @desc    Get a single medicine's details
// @route   GET /api/medicines/:id
// @access  Public
const getMedicineById = catchAsync(async (req, res, next) => {
  const medicine = await Medicine.findById(req.params.id);
  if (!medicine) {
    return next(new AppError('Medicine not found', 404));
  }
  return res.status(200).json({ medicine });
});

module.exports = { listMedicines, getMedicineById };
