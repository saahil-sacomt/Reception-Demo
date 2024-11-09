import express from 'express';
import { generateDailyReport, generateMonthlyReport } from '../controllers/reportController.js';

const router = express.Router();

router.get('/daily', generateDailyReport);
router.get('/monthly', generateMonthlyReport);

export default router;
