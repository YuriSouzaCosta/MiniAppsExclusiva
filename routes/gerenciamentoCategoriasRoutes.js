const express = require('express');
const controller = require('../controllers/gerenciamentoCategoriasController');
const { ensureAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(ensureAuth, requireRole('ADMIN'));
router.get('/', controller.index);
router.post('/', controller.create);
router.post('/salvar-todos', controller.updateAll);
router.post('/:key', controller.update);
router.post('/:key/excluir', controller.remove);
router.post('/acessos/:appKey', controller.assignApp);

module.exports = router;
