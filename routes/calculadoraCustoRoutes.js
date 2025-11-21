const express = require('express');
const router = express.Router();
const calculadoraCustoController = require('../controllers/calculadoraCustoController');
const { ensureAuth } = require('../middleware/authMiddleware');

router.use(ensureAuth);

router.get('/', calculadoraCustoController.index);

module.exports = router;
