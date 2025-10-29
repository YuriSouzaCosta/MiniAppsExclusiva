// routes/contagemRoutes.js
const express = require('express');
const router = express.Router();
const contagemController = require('../controllers/contagemController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware.ensureAuth, contagemController.createContagem);
router.get('/', authMiddleware.ensureAuth, contagemController.listContagens);
router.get('/:usuario', authMiddleware.ensureAuth, contagemController.getContagensByUsuario);
router.delete('/:usuario', authMiddleware.ensureAuth, contagemController.deleteContagensByUsuario);

module.exports = router;
