// server/routes/authRoutes.js
const express = require('express');
const { login, register } = require('../controllers/authController');
const router = express.Router();

// Register new users (Admin-only functionality)
router.post('/register', register);

// Login for both employees and admins
router.post('/login', login);

module.exports = router;
