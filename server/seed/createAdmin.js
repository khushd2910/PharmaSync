/**
 * One-off script to create the first Admin account.
 * Usage:  node seed/createAdmin.js "Admin Name" admin@pharma.com "StrongPass123"
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const run = async () => {
  const [, , name, email, password] = process.argv;

  if (!name || !email || !password) {
    console.log('Usage: node seed/createAdmin.js "Admin Name" admin@pharma.com "StrongPass123"');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email });
  if (existing) {
    console.log('A user with this email already exists. Aborting.');
    process.exit(1);
  }

  const admin = await User.create({
    name,
    email,
    password,
    role: 'admin',
  });

  console.log(`Admin created: ${admin.email}`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
