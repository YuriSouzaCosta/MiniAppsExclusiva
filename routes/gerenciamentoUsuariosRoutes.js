const express = require('express');
const router = express.Router();
const controller = require('../controllers/gerenciamentoUsuariosController');
const { ensureAuth, requireRole } = require('../middleware/authMiddleware');

router.use(ensureAuth, requireRole('ADMIN'));
router.get('/', controller.index);
router.post('/salvar-todos', controller.updateRolesBatch);
router.post('/:codusu/role', controller.updateRole);
module.exports = router;
