// src/api/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);

// Protected routes (require authentication)
router.use(authMiddleware);
router.get('/profile', userController.getUserProfile);
router.put('/profile', userController.updateUserProfile);
router.post('/logout', userController.logoutUser);

// Admin routes (require admin privileges)
router.get('/all', authMiddleware.isAdmin, userController.getAllUsers);
router.delete('/:userId', authMiddleware.isAdmin, userController.deleteUser);

module.exports = router;