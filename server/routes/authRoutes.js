// server/routes/authRoutes.js
import express from 'express';
import { login, register } from '../controllers/authController.js';

const router = express.Router();

// Register new users (Admin-only functionality)
router.post('/register', register);

// Login for both employees and admins
router.post('/login', login);

export default router;
