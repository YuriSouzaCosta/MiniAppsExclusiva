// routes/produtoRoutes.js
const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/:codigo_barra', authMiddleware.ensureAuth, produtoController.getProdutoByCodigo);
router.post('/contagem', authMiddleware.ensureAuth, produtoController.postContagem);

module.exports = router;
