const express = require('express');
const router = express.Router();
const transferenciasController = require('../../controllers/transferencias/transferenciasController');
const { ensureAuth } = require('../../middleware/authMiddleware');

// ========== VIEW ROUTES ==========
router.get('/', ensureAuth, transferenciasController.index);

// ========== API ENDPOINTS ==========
router.get('/api/produto/:codigoBarras', ensureAuth, transferenciasController.buscarProduto);
router.get('/api/estoque/:codProd', ensureAuth, transferenciasController.buscarEstoque);
router.get('/api/locais-destino', ensureAuth, transferenciasController.buscarLocaisDestino);
router.post('/api/criar', ensureAuth, transferenciasController.criarTransferencias);

module.exports = router;
