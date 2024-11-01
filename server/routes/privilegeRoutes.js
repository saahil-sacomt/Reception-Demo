const express = require('express');
const router = express.Router();
const { sendPrivilegeCard } = require('../controllers/privilegeCardController');

router.post('/send-card', sendPrivilegeCard);

module.exports = router;
