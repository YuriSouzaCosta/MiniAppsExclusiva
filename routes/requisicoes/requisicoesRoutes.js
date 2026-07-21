const express = require('express');
const router = express.Router();
const requisicoesController = require('../../controllers/requisicoes/requisicoesController');
const { ensureAuth } = require('../../middleware/authMiddleware');

// ========== API ENDPOINTS ==========
router.get('/api/produtos', ensureAuth, requisicoesController.buscarProdutos);
router.get('/api/requisicoes', ensureAuth, requisicoesController.listarRequisicoes);
router.post('/api/requisicoes', ensureAuth, requisicoesController.criarRequisicao);
router.get('/api/requisicoes/:num', ensureAuth, requisicoesController.obterRequisicao);
router.post('/api/requisicoes/:num/assumir', ensureAuth, requisicoesController.assumirSeparacao);
router.put('/api/requisicoes/:num/itens', ensureAuth, requisicoesController.salvarItens);
router.post('/api/requisicoes/:num/liberar', ensureAuth, requisicoesController.liberarRequisicao);
router.post('/api/requisicoes/:num/receber', ensureAuth, requisicoesController.confirmarRecebimento);
router.post('/api/requisicoes/:num/cancelar', ensureAuth, requisicoesController.cancelarRequisicao);

// ========== VIEW ROUTES ==========
// as rotas fixas vem antes de /:num para nao serem capturadas por ela
router.get('/', ensureAuth, requisicoesController.index);
router.get('/nova', ensureAuth, requisicoesController.nova);
router.get('/separacao', ensureAuth, requisicoesController.separacao);
router.get('/:num(\\d+)', ensureAuth, requisicoesController.detalhe);

module.exports = router;
