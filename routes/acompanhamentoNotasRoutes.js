const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/acompanhamentoNotasController');
const { ensureAuth } = require('../middleware/authMiddleware');

// A role autorizada é definida centralmente em AD_TELAS_PERMISSOES.
router.use(ensureAuth);

router.get('/', ctrl.paginaIndex);              // pagina principal (completa)
router.get('/api/dados', ctrl.apiDados);        // dados completos (JSON)
router.get('/api/itens', ctrl.apiItens);        // itens da nota (XMLTABLE do XML)
router.post('/api/chegada', ctrl.marcarChegada); // carimba/remove "Chegou"

module.exports = router;
