// server/routes/privilegeRoutes.js
const express = require('express');
const { createPrivilegeCard } = require('../controllers/privilegeController');
const router = express.Router();

router.post('/create', createPrivilegeCard);

module.exports = router;
