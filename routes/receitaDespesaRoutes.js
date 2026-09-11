const express = require('express');
const router = express.Router();
const controller = require('../controllers/receitaDespesaController');
const { ensureAuth } = require('../middleware/authMiddleware');

router.use(ensureAuth);
router.get('/', controller.paginaIndex);
router.get('/api/contexto', controller.apiContexto);
router.get('/api/resumo', controller.apiResumo);

module.exports = router;
