const express = require('express');
const { body } = require('express-validator');
const ChatController = require('../../controllers/ai/chat.controller');
const { optionalAuth } = require('../../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for chat
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute
  message: {
    success: false,
    error: 'Too many messages. Please wait a moment before sending another message.'
  }
});

// Chat endpoint
router.post('/chat', 
  optionalAuth, // Allow both authenticated and anonymous users
  chatLimiter,
  [
    body('message')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Message must be between 1 and 500 characters'),
    body('context')
      .optional()
      .isObject()
      .withMessage('Context must be an object')
  ],
  ChatController.sendMessage
);

module.exports = router; 