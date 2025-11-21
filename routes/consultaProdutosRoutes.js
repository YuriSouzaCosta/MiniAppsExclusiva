const express = require('express');
const router = express.Router();
const consultaProdutosController = require('../controllers/consultaProdutosController');
const { ensureAuth } = require('../middleware/authMiddleware');

router.use(ensureAuth);

// Page Routes
router.get('/', consultaProdutosController.index);
router.get('/vendedor', consultaProdutosController.index);

// API Routes
router.get('/api/marcas', consultaProdutosController.getMarcas);
router.get('/api/produtos', consultaProdutosController.searchProducts);
router.get('/api/estoque', consultaProdutosController.getStock);

module.exports = router;
