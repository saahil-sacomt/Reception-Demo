// server/routes/privilegeRoutes.js
import express from 'express';
import { createPrivilegeCard } from '../controllers/privilegeController.js';

const router = express.Router();

router.post('/create', createPrivilegeCard);

export default router;
