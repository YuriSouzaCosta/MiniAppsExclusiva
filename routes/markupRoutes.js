const express = require('express');
const controller = require('../controllers/markupController');
const { ensureAuth } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(ensureAuth);
router.get('/', controller.pagina);
router.get('/api/filtros', controller.filtros);
router.get('/api/resumo', controller.resumo);
module.exports = router;
