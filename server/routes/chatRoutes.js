const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/authMiddleware');
const { sendChatMessage } = require('../controllers/chatController');

// Usable by guests and logged-in users alike — optionalAuth attaches
// req.user when a valid session exists, without blocking the request
// when it doesn't (Module 9 — AI Chatbot).
router.post('/', optionalAuth, sendChatMessage);

module.exports = router;
