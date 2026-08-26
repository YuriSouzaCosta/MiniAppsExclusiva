const router = require('express').Router();
const controller = require('../controllers/comprasMarcasController');
const { ensureAuth } = require('../middleware/authMiddleware');
router.use(ensureAuth);
router.get('/', controller.pagina);
router.get('/api/filtros', controller.apiFiltros);
router.get('/api/dados', controller.apiDados);
module.exports = router;
