const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/acompanhamentoFinanceiroController');
const { ensureAuth, requireRole } = require('../middleware/authMiddleware');

// protege com login e restringe para ADMIN
router.use(ensureAuth);
router.use(requireRole('ADMIN'));

router.get('/', ctrl.paginaIndex);          // pagina principal
router.get('/api/dados', ctrl.apiDados);    // titulos a pagar (JSON)

module.exports = router;
