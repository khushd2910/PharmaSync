const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // never return password by default
    },
    phone: {
      type: String,
      trim: true,
    },
    // Multiple saved addresses (e.g. Home / Work) instead of a single one —
    // each still structured so it can be dropped straight into the checkout
    // form's fields (line1/city/state/pincode) without any re-parsing of a
    // single free-text string. Exactly one address should have isDefault
    // true at a time; that's the one Checkout pre-fills.
    addresses: {
      type: [
        {
          label: { type: String, trim: true, default: 'Home' },
          line1: { type: String, trim: true, default: '' },
          city: { type: String, trim: true, default: '' },
          state: { type: String, trim: true, default: '' },
          pincode: { type: String, trim: true, default: '' },
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    // Medicines the user has bookmarked for later from the storefront —
    // just ids; full medicine data is looked up fresh on read so it can
    // never go stale the way a cached copy could.
    wishlist: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }],
      default: [],
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
    verificationExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    // hashed copy of the current valid refresh token, so a stolen/expired
    // token can be invalidated server-side (e.g. on logout, or "log out of
    // all devices" — since only one refresh token is tracked at a time,
    // clearing this hash invalidates whatever session(s) currently rely on
    // it, the same mechanism logout already uses)
    refreshTokenHash: {
      type: String,
      select: false,
    },
    // Login-activity tracking for the profile page's security section.
    // previousLoginAt is set from the outgoing lastLoginAt right before
    // lastLoginAt is refreshed, so "Last login" can show the *previous*
    // sign-in rather than the one happening right now.
    lastLoginAt: {
      type: Date,
    },
    previousLoginAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Generates a random email-verification token, stores its SHA-256 hash on
// the document, and returns the RAW token (only the raw token is emailed —
// the hash is what's stored, mirroring how passwords are never stored raw)
userSchema.methods.createVerificationToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.verificationToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h
  return rawToken;
};

// Same pattern for password-reset tokens
userSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1h
  return rawToken;
};

// Hashes a refresh token the same way, for storage/comparison
userSchema.methods.hashToken = function (rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

module.exports = mongoose.model('User', userSchema);
