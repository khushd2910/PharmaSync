const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadPrescription: uploadMiddleware } = require('../middleware/uploadPrescription');
const {
  uploadPrescription,
  getMyPrescriptions,
  getPrescriptionFile,
} = require('../controllers/prescriptionController');

router.use(protect); // every prescription route requires login

// @desc  Upload a prescription file (multipart/form-data, field "prescription")
// @route POST /api/prescriptions
router.post('/', uploadMiddleware.single('prescription'), uploadPrescription);

// @desc  List the logged-in user's own prescription uploads
// @route GET /api/prescriptions
router.get('/', getMyPrescriptions);

// @desc  View/download one prescription file (owner or admin only)
// @route GET /api/prescriptions/:id/file
router.get('/:id/file', getPrescriptionFile);

module.exports = router;
