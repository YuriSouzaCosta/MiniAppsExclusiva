const express = require('express');
const router = express.Router();
const analiseTransferenciasController = require('../../controllers/transferencias/analiseTransferenciasController');
const { ensureAuth } = require('../../middleware/authMiddleware');

// ========== VIEW ROUTES ==========
router.get('/', ensureAuth, analiseTransferenciasController.index);

// ========== API ENDPOINTS ==========
router.get('/api/pendentes', ensureAuth, analiseTransferenciasController.buscarTransferenciasPendentes);
router.get('/api/finalizadas', ensureAuth, analiseTransferenciasController.buscarTransferenciasFinalizadas);
router.get('/api/analise-periodo', ensureAuth, analiseTransferenciasController.buscarAnalisePorPeriodo);
router.get('/api/analise-produto', ensureAuth, analiseTransferenciasController.buscarAnalisePorProduto);
router.get('/api/analise-local', ensureAuth, analiseTransferenciasController.buscarAnalisePorLocal);

module.exports = router;
