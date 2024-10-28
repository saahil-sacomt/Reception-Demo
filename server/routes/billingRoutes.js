// server/routes/billingRoutes.js
const express = require('express');
const { createBillingRecord } = require('../controllers/billingController');
const router = express.Router();

router.post('/create', createBillingRecord);

module.exports = router;
