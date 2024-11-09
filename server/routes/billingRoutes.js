// server/routes/billingRoutes.js
import express from 'express';
import { createBillingRecord } from '../controllers/billingController.js';

const router = express.Router();

router.post('/create', createBillingRecord);

export default router;
