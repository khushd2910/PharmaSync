const Medicine = require('../models/Medicine');
const Cart = require('../models/Cart');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const fetchDrugInfo = require('../utils/fetchDrugInfo');
const { LOW_STOCK_THRESHOLD, EXPIRY_WINDOW_DAYS } = require('../utils/inventoryConstants');

const SORT_OPTIONS = {
  name: { name: 1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  newest: { createdAt: -1 },
};

// Escapes regex special characters so user input can never be interpreted
// as regex syntax (avoids both errors and regex-injection surprises)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Case-insensitive SUBSTRING search (not MongoDB's $text, which only does
// whole-word/stemmed matching and would miss "roz" inside "Rozu"). Splits
// the query into words so "amox clav" or "clav amox" both match a medicine
// containing both substrings somewhere across name/manufacturer/
// composition, regardless of which order the words were typed in — that
// covers realistic reordering (brand vs. manufacturer word order) without
// resorting to full letter-by-letter anagram matching, which would wreck
// result relevance for everyone else (e.g. "tab" would start matching "bat").
const buildSearchFilter = (search) => {
  const tokens = search.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  return {
    $and: tokens.map((token) => {
      const regex = new RegExp(escapeRegex(token), 'i');
      return {
        $or: [{ name: regex }, { manufacturer: regex }, { composition1: regex }, { composition2: regex }],
      };
    }),
  };
};

// @desc    List/search/filter medicines with pagination — publicly
//          accessible so guests can browse before creating an account.
//          Also powers Home page sections via query flags (featured, onOffer).
// @route   GET /api/medicines?search=&category=&brand=&prescriptionRequired=&inStock=&sort=&page=&limit=
// @access  Public
const listMedicines = catchAsync(async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

  const filter = { isDiscontinued: { $ne: true } };

  const searchFilter = search ? buildSearchFilter(search) : null;
  if (searchFilter) {
    Object.assign(filter, searchFilter);
  }
  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.brand) {
    filter.manufacturer = req.query.brand;
  }
  if (req.query.prescriptionRequired === 'true') {
    filter.requiresPrescription = true;
  } else if (req.query.prescriptionRequired === 'false') {
    filter.requiresPrescription = false;
  }
  if (req.query.inStock === 'true') {
    filter.stock = { $gt: 0 };
  }
  if (req.query.featured === 'true') {
    filter.isFeatured = true;
  }
  if (req.query.onOffer === 'true') {
    filter.discountPercent = { $gt: 0 };
  }

  const sortKey = SORT_OPTIONS[req.query.sort] ? req.query.sort : 'name';

  const [medicines, total] = await Promise.all([
    Medicine.find(filter)
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

// @desc    Distinct list of categories, for the Home page's category pills
//          and the search filter dropdown
// @route   GET /api/medicines/categories
// @access  Public
const getCategories = catchAsync(async (req, res) => {
  const categories = await Medicine.distinct('category', { isDiscontinued: { $ne: true } });
  return res.status(200).json({ categories: categories.filter(Boolean).sort() });
});

// @desc    Distinct list of manufacturers, for the brand search filter
// @route   GET /api/medicines/brands
// @access  Public
const getBrands = catchAsync(async (req, res) => {
  const brands = await Medicine.distinct('manufacturer', { isDiscontinued: { $ne: true } });
  return res.status(200).json({ brands: brands.filter(Boolean).sort() });
});

// @desc    Get a single medicine's details, enriched with a live openFDA
//          lookup where a reliable US-generic-name match exists
// @route   GET /api/medicines/:id
// @access  Public
const getMedicineById = catchAsync(async (req, res, next) => {
  const medicine = await Medicine.findById(req.params.id);
  if (!medicine) {
    return next(new AppError('Medicine not found', 404));
  }

  const apiInfo = await fetchDrugInfo(medicine.fdaAlias);

  return res.status(200).json({ medicine, apiInfo });
});

// @desc    Add a new medicine to the catalog (admin manual entry). New
//          medicines are immediately visible to guest/user browsing and, once
//          POS billing exists, to in-store sale too — there's a single
//          catalog, not separate online/offline records.
// @route   POST /api/admin/medicines
// @access  Private (admin)
const createMedicine = catchAsync(async (req, res, next) => {
  const {
    name,
    brand,
    category,
    price,
    stock,
    expiryDate,
    manufacturer,
    description,
    requiresPrescription,
  } = req.body;

  const medicine = await Medicine.create({
    name,
    brand,
    category,
    price,
    stock,
    expiryDate: expiryDate || undefined,
    manufacturer,
    description,
    requiresPrescription: requiresPrescription === true || requiresPrescription === 'true',
  });

  return res.status(201).json({ message: 'Medicine added successfully', medicine });
});

// @desc    List medicines for the admin management table — unlike the public
//          listing, this INCLUDES discontinued items, since an admin needs to
//          find and re-enable/edit them too. Supports the dashboard's "Low
//          Stock" / "Expiring Soon" alert cards via query flags.
// @route   GET /api/admin/medicines?search=&lowStock=&expiringSoon=&page=&limit=
// @access  Private (admin)
const adminListMedicines = catchAsync(async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const filter = search ? buildSearchFilter(search) || {} : {};

  if (req.query.lowStock === 'true') {
    filter.isDiscontinued = false;
    filter.stock = { $lte: LOW_STOCK_THRESHOLD };
  }
  if (req.query.expiringSoon === 'true') {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    filter.isDiscontinued = false;
    filter.expiryDate = { $gte: now, $lte: windowEnd };
  }

  const [medicines, total] = await Promise.all([
    Medicine.find(filter)
      .sort({ stock: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Medicine.countDocuments(filter),
  ]);

  return res.status(200).json({
    medicines,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    lowStockThreshold: LOW_STOCK_THRESHOLD,
  });
});

// @desc    Edit an existing medicine (e.g. price, stock, description). Since
//          the storefront and future POS both read from this same Medicine
//          collection, any change here takes effect everywhere immediately —
//          there's nothing separate to "sync" to the online or offline side.
// @route   PATCH /api/admin/medicines/:id
// @access  Private (admin)
const updateMedicine = catchAsync(async (req, res, next) => {
  const EDITABLE_FIELDS = [
    'name',
    'brand',
    'category',
    'price',
    'stock',
    'expiryDate',
    'manufacturer',
    'description',
    'requiresPrescription',
    'isDiscontinued',
  ];

  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  if (updates.expiryDate === '') {
    updates.expiryDate = null;
  }

  const medicine = await Medicine.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  if (!medicine) {
    return next(new AppError('Medicine not found', 404));
  }

  return res.status(200).json({ message: 'Medicine updated successfully', medicine });
});

// @desc    Permanently remove a medicine from inventory. Past orders keep
//          their own name/price snapshot (see Order model), so order history
//          stays intact — this only affects future browsing/cart/checkout.
//          Also pulls the medicine out of every user's cart so no one is left
//          with a dangling cart line for something that no longer exists.
// @route   DELETE /api/admin/medicines/:id
// @access  Private (admin)
const deleteMedicine = catchAsync(async (req, res, next) => {
  const medicine = await Medicine.findByIdAndDelete(req.params.id);
  if (!medicine) {
    return next(new AppError('Medicine not found', 404));
  }

  await Cart.updateMany({}, { $pull: { items: { medicine: medicine._id } } });

  return res.status(200).json({ message: 'Medicine removed from inventory' });
});

// @desc    Refill stock for a medicine by a given amount (adds to whatever
//          stock currently is, rather than overwriting it — the quick action
//          for "Admin refills stock" once a low-stock alert fires).
// @route   PATCH /api/admin/medicines/:id/restock
// @access  Private (admin)
const restockMedicine = catchAsync(async (req, res, next) => {
  const amount = Number(req.body.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return next(new AppError('amount must be a whole number greater than 0', 400));
  }

  const medicine = await Medicine.findByIdAndUpdate(
    req.params.id,
    { $inc: { stock: amount } },
    { new: true }
  );

  if (!medicine) {
    return next(new AppError('Medicine not found', 404));
  }

  return res.status(200).json({ message: `Stock increased by ${amount}`, medicine });
});

module.exports = {
  listMedicines,
  getCategories,
  getBrands,
  getMedicineById,
  createMedicine,
  adminListMedicines,
  updateMedicine,
  deleteMedicine,
  restockMedicine,
};
