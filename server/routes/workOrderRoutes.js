import express from 'express';
import { createWorkOrder, getInitialWorkOrderCount } from '../controllers/workOrderController.js';

const router = express.Router();

// Route to save work order
router.get('/initial-count', getInitialWorkOrderCount);
router.post('/work-orders', createWorkOrder);

export default router;
