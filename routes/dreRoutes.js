const express = require('express');
const controller = require('../controllers/dreController');
const { ensureAuth } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(ensureAuth);
router.get('/', controller.pagina);
router.get('/api/empresas', controller.empresas);
router.get('/api/resumo', controller.resumo);
router.get('/api/detalhes', controller.detalhes);

module.exports = router;
