const express = require('express');
const router = express.Router();
const faturamentoController = require('../controllers/faturamentoController');
const { ensureAuth } = require('../middleware/authMiddleware');

// protege todas as rotas do painel com o login existente (cookie JWT)
router.use(ensureAuth);

// Paginas
router.get('/', faturamentoController.paginaIndex);            // pagina detalhada (analise)
router.get('/painel', faturamentoController.paginaPainel);      // painel TV / mobile
router.get('/vendedor', faturamentoController.paginaVendedor);  // tela de analise do vendedor

// API
router.get('/api/filtros', faturamentoController.apiFiltros);
router.get('/api/dados', faturamentoController.apiDados);    // faturamento por vendedor
router.get('/api/painel', faturamentoController.apiPainel);  // painel: atual + ano anterior (YoY)
router.get('/api/stream', faturamentoController.apiStream);  // SSE (auto-atualizacao por push)
router.get('/api/heatmap', faturamentoController.apiHeatmap);   // mapa dia x hora
router.get('/api/vendedor', faturamentoController.apiVendedor); // totais + serie do vendedor
router.get('/api/metas', faturamentoController.apiMetas);       // metas (JSON)
router.post('/api/meta', faturamentoController.apiMetaSet);     // salva meta (JSON)

module.exports = router;
