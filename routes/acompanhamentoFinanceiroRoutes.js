const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/acompanhamentoFinanceiroController');
const { ensureAuth } = require('../middleware/authMiddleware');

// A role autorizada é definida centralmente em AD_TELAS_PERMISSOES.
router.use(ensureAuth);

router.get('/', ctrl.paginaIndex);          // pagina principal
router.get('/api/dados', ctrl.apiDados);    // titulos a pagar (JSON)

module.exports = router;
