const express = require('express');
const router = express.Router();
const controller = require('../controllers/gerenciamentoUsuariosController');
const { ensureAuth, requireRole } = require('../middleware/authMiddleware');

router.use(ensureAuth, requireRole('ADMIN'));
router.get('/', controller.screens);
router.post('/:screenKey', controller.updateScreenRoles);

module.exports = router;
