const express = require('express');
const controller = require('../controllers/fluxoCaixaController');
const receitaManual = require('../controllers/receitaManualController');
const { ensureAuth } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(ensureAuth);
router.get('/', controller.pagina);
router.get('/api/empresas', controller.empresas);
router.get('/api/resumo', controller.resumo);
router.get('/api/detalhes', controller.detalhes);
router.get('/api/receita-manual', receitaManual.carregar);
router.put('/api/receita-manual', receitaManual.salvar);

module.exports = router;
