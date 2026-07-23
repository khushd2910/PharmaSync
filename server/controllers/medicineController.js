const Medicine = require('../models/Medicine');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const POSSale = require('../models/POSSale');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const fetchDrugInfo = require('../utils/fetchDrugInfo');
const { LOW_STOCK_THRESHOLD, EXPIRY_WINDOW_DAYS } = require('../utils/inventoryConstants');
const { parse: parseCsv } = require('csv-parse/sync');

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
    barcode,
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
    barcode: barcode || undefined,
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
    'barcode',
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

  // Clearing the barcode needs $unset, not $set-to-null/empty-string — the
  // sparse-unique index only skips documents where the field is entirely
  // *absent*. A stored null or '' would still be indexed, so two medicines
  // with a cleared barcode would collide on the unique constraint.
  let clearBarcode = false;
  if (updates.barcode === '') {
    delete updates.barcode;
    clearBarcode = true;
  }

  const medicine = await Medicine.findByIdAndUpdate(
    req.params.id,
    clearBarcode ? { $set: updates, $unset: { barcode: '' } } : updates,
    { new: true, runValidators: true }
  );

  if (!medicine) {
    return next(new AppError('Medicine not found', 404));
  }

  return res.status(200).json({ message: 'Medicine updated successfully', medicine });
});

// @desc    Permanently remove a medicine from inventory — but only if it
//          has never actually been sold (online or in-store). A medicine
//          with sales history is rejected with a 409 directing the admin to
//          discontinue it instead (isDiscontinued), which keeps that
//          history intact. Also pulls the medicine out of every user's
//          cart so no one is left with a dangling cart line.
// @route   DELETE /api/admin/medicines/:id
// @access  Private (admin)
const deleteMedicine = catchAsync(async (req, res, next) => {
  const medicine = await Medicine.findById(req.params.id);
  if (!medicine) {
    return next(new AppError('Medicine not found', 404));
  }

  // A hard delete on a medicine that has actual sales history would sever
  // what analytics/receipts can show for it going forward (best/worst
  // sellers, inventory trend) — the `isDiscontinued` flag exists exactly
  // to remove something from sale without destroying that history.
  // Reserve the permanent delete for genuine mistakes (added the wrong
  // item, duplicate entry, ...) that never actually sold anything.
  const [hasOnlineSales, hasPosSales] = await Promise.all([
    Order.exists({ 'items.medicine': medicine._id }),
    POSSale.exists({ 'items.medicine': medicine._id }),
  ]);
  if (hasOnlineSales || hasPosSales) {
    return next(
      new AppError(
        `"${medicine.name}" has past sales on record and can't be permanently deleted. Discontinue it instead — that removes it from sale everywhere while keeping its order/sales history intact.`,
        409
      )
    );
  }

  await medicine.deleteOne();
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

const BULK_IMPORT_MAX_ROWS = 500;

// Column headers a real pharmacy admin would produce in Excel/CSV, matching
// the Add Medicine form's own fields — deliberately NOT the raw external
// dataset's column names (short_composition1, Is_discontinued, ...) used by
// server/scripts/importMedicines.js, since that format is specific to one
// seed dataset and isn't something an admin would hand-author.
const REQUIRED_COLUMNS = ['name', 'price', 'stock'];
const OPTIONAL_COLUMNS = ['brand', 'category', 'manufacturer', 'description', 'expiryDate', 'requiresPrescription', 'barcode'];

const toBool = (val) => {
  const s = String(val ?? '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
};

// Validates and coerces one CSV row into a Medicine-shaped object, or
// returns a { error } describing why it can't be imported. Never throws —
// one malformed row should never abort the rest of the batch.
const mapRow = (row, rowNumber) => {
  const name = (row.name || '').trim();
  if (!name) return { error: `Row ${rowNumber}: name is required` };

  const price = Number(row.price);
  if (!Number.isFinite(price) || price < 0) return { error: `Row ${rowNumber}: price must be a positive number` };

  const stock = Number(row.stock);
  if (!Number.isInteger(stock) || stock < 0) return { error: `Row ${rowNumber}: stock must be a whole number, 0 or more` };

  let expiryDate;
  if (row.expiryDate) {
    const parsed = new Date(row.expiryDate);
    if (Number.isNaN(parsed.getTime())) return { error: `Row ${rowNumber}: expiryDate "${row.expiryDate}" isn't a valid date` };
    expiryDate = parsed;
  }

  return {
    doc: {
      name,
      price,
      stock,
      brand: row.brand?.trim() || undefined,
      category: row.category?.trim() || undefined,
      manufacturer: row.manufacturer?.trim() || undefined,
      description: row.description?.trim() || undefined,
      expiryDate,
      requiresPrescription: toBool(row.requiresPrescription),
      barcode: row.barcode?.trim() || undefined,
    },
  };
};

// @desc    Bulk-add or bulk-update medicines from a CSV pasted/uploaded by
//          an admin. Reads raw CSV text in the request body (parsed
//          entirely client-side via FileReader — no multipart/file-upload
//          middleware needed, since csv-parse only needs a string).
//          Matching row: a row whose barcode matches an existing medicine's
//          barcode UPDATES that record; every other row CREATES a new one
//          (this catalog allows multiple medicines sharing a name from
//          different manufacturers, so name alone is never treated as a
//          safe match key).
// @route   POST /api/admin/medicines/bulk-import
// @access  Private (admin)
const bulkImportMedicines = catchAsync(async (req, res, next) => {
  const { csv } = req.body;
  if (!csv || typeof csv !== 'string' || !csv.trim()) {
    return next(new AppError('csv (raw CSV text) is required', 400));
  }

  let rows;
  try {
    rows = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return next(new AppError(`Could not parse CSV: ${err.message}`, 400));
  }

  if (rows.length === 0) {
    return next(new AppError('CSV has no data rows', 400));
  }
  if (rows.length > BULK_IMPORT_MAX_ROWS) {
    return next(new AppError(`CSV has ${rows.length} rows — split it into batches of ${BULK_IMPORT_MAX_ROWS} or fewer`, 400));
  }

  const headerRow = Object.keys(rows[0]).map((h) => h.trim().toLowerCase());
  const missingRequired = REQUIRED_COLUMNS.filter((col) => !headerRow.includes(col.toLowerCase()));
  if (missingRequired.length > 0) {
    return next(
      new AppError(
        `CSV is missing required column(s): ${missingRequired.join(', ')}. Expected columns: ${[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].join(', ')}`,
        400
      )
    );
  }

  let created = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header line itself
    const result = mapRow(rows[i], rowNumber);
    if (result.error) {
      errors.push(result.error);
      continue;
    }

    try {
      if (result.doc.barcode) {
        const existing = await Medicine.findOne({ barcode: result.doc.barcode });
        if (existing) {
          await Medicine.updateOne({ _id: existing._id }, { $set: result.doc });
          updated += 1;
          continue;
        }
      }
      await Medicine.create(result.doc);
      created += 1;
    } catch (err) {
      // Most likely a duplicate barcode colliding with another row in this
      // same batch, or a schema validation error — record it and continue.
      errors.push(`Row ${rowNumber} ("${result.doc.name}"): ${err.message}`);
    }
  }

  return res.status(200).json({
    message: `Imported ${created + updated} of ${rows.length} rows (${created} created, ${updated} updated, ${errors.length} skipped)`,
    created,
    updated,
    skipped: errors.length,
    errors: errors.slice(0, 25), // cap what's echoed back — a bad file could otherwise return hundreds of lines
  });
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
  bulkImportMedicines,
};
