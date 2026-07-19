const Medicine = require('../models/Medicine');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const fetchDrugInfo = require('../utils/fetchDrugInfo');

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
//          find and re-enable/edit them too.
// @route   GET /api/admin/medicines?search=&page=&limit=
// @access  Private (admin)
const adminListMedicines = catchAsync(async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const filter = search ? buildSearchFilter(search) || {} : {};

  const [medicines, total] = await Promise.all([
    Medicine.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Medicine.countDocuments(filter),
  ]);

  return res.status(200).json({
    medicines,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
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

module.exports = {
  listMedicines,
  getCategories,
  getBrands,
  getMedicineById,
  createMedicine,
  adminListMedicines,
  updateMedicine,
};
