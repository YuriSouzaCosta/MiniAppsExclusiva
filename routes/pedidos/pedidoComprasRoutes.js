const express = require('express');
const router = express.Router();
const pedidoComprasController = require('../../controllers/pedidos/pedidoComprasController');
const { ensureAuth } = require('../../middleware/authMiddleware');

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
router.get('/carregarItensSankhya', ensureAuth, pedidoComprasController.carregarItensSankhya);
router.post('/salvarItensSankhya', ensureAuth, pedidoComprasController.salvarItensSankhya);
router.post('/finalizarPedidoComValores', ensureAuth, pedidoComprasController.finalizarPedidoComValores);

if (pedidoComprasController.reprocessarPedido) {
    router.post('/reprocessar-pedido/:id', ensureAuth, pedidoComprasController.reprocessarPedido);
} else {
    router.post('/reprocessar-pedido/:id', ensureAuth, (req, res) => {
        console.error("AVISO DE SINCRONIZACAO: reprocessarPedido nao encontrado no Controller.");
        res.status(500).json({ error: "Sincronização Inválida", details: "O arquivo pedidoComprasController.js na nuvem não possui a nova função. Por favor, atualize-o." });
    });
}

router.get('/painel', ensureAuth, pedidoComprasController.painelPedidos);
router.get('/api/painel-dados', ensureAuth, pedidoComprasController.getPainelDados);

module.exports = router;
