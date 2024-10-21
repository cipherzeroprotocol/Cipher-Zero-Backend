// src/api/routes/messageRoutes.js

const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

// All message routes require authentication
router.use(authMiddleware);

// Send a new message
router.post('/send', messageController.sendMessage);

// Get all messages for the authenticated user
router.get('/inbox', messageController.getInbox);

// Get a specific message by ID
router.get('/:messageId', messageController.getMessage);

// Delete a message
router.delete('/:messageId', messageController.deleteMessage);

// Mark a message as read
router.put('/:messageId/read', messageController.markAsRead);

// Get all messages in a conversation with another user
router.get('/conversation/:userId', messageController.getConversation);

// Encrypt a message (for client-side encryption before sending)
router.post('/encrypt', messageController.encryptMessage);

// Decrypt a message (for client-side decryption after receiving)
router.post('/decrypt', messageController.decryptMessage);

module.exports = router;