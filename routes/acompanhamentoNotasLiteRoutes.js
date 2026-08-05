const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/acompanhamentoNotasController');
const { ensureAuth } = require('../middleware/authMiddleware');

router.use(ensureAuth);

router.get('/', ctrl.paginaIndexLite);              // página HTML Lite
router.get('/api/dados', ctrl.apiDadosLite);        // dados filtrados somente por notas pendentes (não lançadas)
router.get('/api/itens', ctrl.apiItens);            // detalhamento de itens no modal

module.exports = router;
