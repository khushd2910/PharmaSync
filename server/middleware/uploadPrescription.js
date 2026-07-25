const fs = require('fs');
const path = require('path');
const multer = require('multer');
const AppError = require('../utils/AppError');

// Files land in <repo root>/uploads/prescriptions/ — the same `uploads/`
// folder the project brief already sets aside for this ("Prescription
// uploads (for future verification modules)"). This middleware lives in
// server/middleware/, so ../.. gets back to the repo root from there.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'prescriptions');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — plenty for a scanned/photographed prescription

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Prefixed with the user id + timestamp so files never collide and a
  // stray filename can't be used to guess/overwrite someone else's upload.
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${req.user._id}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new AppError('Prescription must be a PDF, JPG, PNG, or WEBP file', 400));
  }
  cb(null, true);
};

const uploadPrescription = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

module.exports = { uploadPrescription, UPLOAD_DIR };
