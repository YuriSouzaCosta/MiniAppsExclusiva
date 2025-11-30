const express = require('express');
const router = express.Router();
const pedidoComprasController = require('../controllers/pedidoComprasController');
const { ensureAuth } = require('../middleware/authMiddleware');

// ========== VIEW ROUTES ==========
router.get('/pedidosCompras', ensureAuth, pedidoComprasController.index);
router.get('/listaPedidos', ensureAuth, pedidoComprasController.listaPedidos);
router.get('/fazerPedidos', ensureAuth, pedidoComprasController.fazerPedidos);
router.get('/finalizarPedidos', ensureAuth, pedidoComprasController.finalizarPedidos);
router.get('/pedidosFinalizados', ensureAuth, pedidoComprasController.pedidosFinalizados);

// ========== API ENDPOINTS ==========
router.get('/carregarMarcas', ensureAuth, pedidoComprasController.carregarMarcas);
router.get('/carregarFornecedores', ensureAuth, pedidoComprasController.carregarFornecedores);
router.get('/carregarFormaPagamentos', ensureAuth, pedidoComprasController.carregarFormaPagamentos);
router.post('/criarPedido', ensureAuth, pedidoComprasController.criarPedido);
router.get('/consultarPedidos', ensureAuth, pedidoComprasController.consultarPedidos);
router.get('/consultarPedidosFeitos', ensureAuth, pedidoComprasController.consultarPedidosFeitos);
router.get('/consultarPedidosCompleto', ensureAuth, pedidoComprasController.consultarPedidosCompleto);
router.get('/loadPedidos', ensureAuth, pedidoComprasController.loadPedidos);
router.delete('/fecharPedido', ensureAuth, pedidoComprasController.fecharPedido);
router.post('/finalizarPedidoFinal', ensureAuth, pedidoComprasController.finalizarPedidoFinal);
router.get('/exportarPdf', ensureAuth, pedidoComprasController.exportarPdf);
router.post('/salvarPedidos', ensureAuth, pedidoComprasController.salvarPedidos);
router.post('/atualizarPedidoFeito', ensureAuth, pedidoComprasController.atualizarPedidoFeito);

module.exports = router;
