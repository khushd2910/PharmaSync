/**
 * Imports only COMMON medicines into MongoDB — filtered from the full
 * Indian Medicine Dataset CSV down to a curated whitelist of ~45 everyday
 * active ingredients (see data/commonMolecules.js), instead of importing
 * all 253k+ rows.
 *
 * Usage:
 *   node scripts/importCommonMedicines.js
 *   node scripts/importCommonMedicines.js /path/to/other.csv
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');
const MOLECULES = require('../data/commonMolecules');

const csvPath = process.argv[2] || path.join(__dirname, '../data/indian_medicine_data.csv');

// Caps keep the catalog genuinely small and demo-friendly rather than
// letting one popular molecule (e.g. Paracetamol) dominate the whole list.
const MAX_PER_MOLECULE = 25;
const MAX_TOTAL = 1200;

const toBool = (val) => String(val).trim().toUpperCase() === 'TRUE';

const toPrice = (val) => {
  const cleaned = String(val).replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : undefined;
};

// Finds the first molecule definition whose regex matches this medicine's
// composition — returns null if it's not on the common-medicine whitelist
const findMolecule = (composition1) => {
  if (!composition1) return null;
  return MOLECULES.find((m) => m.match.test(composition1)) || null;
};

const mapRow = (row, molecule) => {
  const name = row.name?.trim();
  if (!name) return null;

  return {
    name,
    price: toPrice(row['price(₹)']),
    manufacturer: row.manufacturer_name?.trim(),
    type: row.type?.trim() || 'allopathy',
    packSizeLabel: row.pack_size_label?.trim(),
    composition1: row.short_composition1?.trim(),
    composition2: row.short_composition2?.trim(),
    isDiscontinued: toBool(row.Is_discontinued),
    category: molecule.category,
    requiresPrescription: molecule.requiresPrescription,
    uses: molecule.uses,
    sideEffects: molecule.sideEffects,
    dosage: molecule.dosage,
    fdaAlias: molecule.fdaAlias || undefined,
    // The dataset has no real stock/sales/expiry data — seed plausible
    // demo values so the details page and expiry-alert features have
    // something realistic to show.
    stock: Math.floor(Math.random() * 150),
    expiryDate: new Date(Date.now() + (90 + Math.random() * 545) * 24 * 60 * 60 * 1000), // 3–21 months out
    isFeatured: Math.random() < 0.08,
    discountPercent: Math.random() < 0.12 ? [10, 15, 20, 25, 30][Math.floor(Math.random() * 5)] : 0,
  };
};

const run = async () => {
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    console.error('Download it from https://github.com/junioralive/Indian-Medicine-Dataset (DATA/indian_medicine_data.csv)');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Clearing existing medicines collection...');
  await Medicine.deleteMany({});

  const perMoleculeCount = new Map();
  const seenNames = new Set();
  let batch = [];
  let total = 0;
  let scanned = 0;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    try {
      await Medicine.insertMany(batch, { ordered: false });
    } catch (err) {
      // some docs in the batch may fail validation — the rest still insert
    }
    batch = [];
  };

  const parser = fs.createReadStream(csvPath).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_column_count: true, trim: true })
  );

  for await (const row of parser) {
    scanned += 1;
    if (total >= MAX_TOTAL) break;
    if (toBool(row.Is_discontinued)) continue;

    const molecule = findMolecule(row.short_composition1);
    if (!molecule) continue;

    // key by the specific molecule (its position in the whitelist), not by
    // category — several molecules can share a category (e.g. Paracetamol
    // and Ibuprofen are both "Pain Relief") and each deserves its own cap
    const moleculeKey = MOLECULES.indexOf(molecule);
    const countForMolecule = perMoleculeCount.get(moleculeKey) || 0;
    if (countForMolecule >= MAX_PER_MOLECULE) continue;

    const name = row.name?.trim();
    if (!name || seenNames.has(name)) continue;
    seenNames.add(name);

    const doc = mapRow(row, molecule);
    if (!doc) continue;

    batch.push(doc);
    perMoleculeCount.set(moleculeKey, countForMolecule + 1);
    total += 1;

    if (batch.length >= 200) {
      await flushBatch();
    }
  }
  await flushBatch();

  console.log('Creating search indexes...');
  await Medicine.syncIndexes();

  const categoryTotals = new Map();
  for (const [moleculeKey, count] of perMoleculeCount.entries()) {
    const cat = MOLECULES[moleculeKey].category;
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + count);
  }

  console.log(`\nScanned ${scanned} rows, imported ${total} common medicines across ${categoryTotals.size} categories.`);
  console.log('Category breakdown:');
  for (const [cat, count] of categoryTotals.entries()) {
    console.log(`  ${cat}: ${count}`);
  }

  process.exit(0);
};

run().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
