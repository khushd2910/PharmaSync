/**
 * Bulk-imports the Indian Medicine Dataset (253k+ rows) into MongoDB.
 *
 * Source: https://github.com/junioralive/Indian-Medicine-Dataset
 * (community-maintained, free to use — see that repo for attribution/license
 * details before using in a production/commercial deployment)
 *
 * Usage:
 *   node scripts/importMedicines.js                 # uses data/indian_medicine_data.csv
 *   node scripts/importMedicines.js /path/to/other.csv
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');

const csvPath = process.argv[2] || path.join(__dirname, '../data/indian_medicine_data.csv');
const BATCH_SIZE = 1000;

const toBool = (val) => String(val).trim().toUpperCase() === 'TRUE';

const toPrice = (val) => {
  const cleaned = String(val).replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : undefined;
};

const mapRow = (row) => {
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
  };
};

const run = async () => {
  console.log('\n⚠️  WARNING: this script imports all 253k+ medicines with NO demo');
  console.log('   stock/category/featured/discount data — everything will show as');
  console.log('   out of stock and the Offers/Popular rows will be empty.');
  console.log('   You almost certainly want: node scripts/importCommonMedicines.js');
  console.log('   Continuing in 5 seconds... (Ctrl+C to cancel)\n');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    console.error('Download it from https://github.com/junioralive/Indian-Medicine-Dataset (DATA/indian_medicine_data.csv)');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Clearing existing medicines collection...');
  await Medicine.deleteMany({});

  let batch = [];
  let total = 0;
  let skipped = 0;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    try {
      await Medicine.insertMany(batch, { ordered: false });
      total += batch.length;
    } catch (err) {
      // insertMany with ordered:false still inserts the valid docs and
      // reports failures for the rest — count what actually got through
      const inserted = err.insertedDocs?.length ?? 0;
      total += inserted;
      skipped += batch.length - inserted;
    }
    batch = [];
    process.stdout.write(`\rImported: ${total}  Skipped: ${skipped}`);
  };

  const parser = fs.createReadStream(csvPath).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_column_count: true, trim: true })
  );

  for await (const row of parser) {
    const doc = mapRow(row);
    if (!doc) {
      skipped += 1;
      continue;
    }
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
    }
  }
  await flushBatch();

  console.log('\nCreating search indexes (if not already present)...');
  await Medicine.syncIndexes();

  console.log(`\nDone. Imported ${total} medicines, skipped ${skipped} invalid rows.`);
  process.exit(0);
};

run().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
