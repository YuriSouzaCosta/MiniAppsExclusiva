// routes/exportacaoRoutes.js
const express = require('express');
const router = express.Router();
const exportacaoController = require('../controllers/exportacaoController');
const authMiddleware = require('../middleware/authMiddleware');

// Exportar contagens por usuário
router.get('/exportar/:usuario', authMiddleware.ensureAuth, exportacaoController.exportarContagens);

module.exports = router;
