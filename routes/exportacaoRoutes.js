// routes/exportacaoRoutes.js
const express = require('express');
const router = express.Router();
const exportacaoController = require('../controllers/exportacaoController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/exportar/:usuario', authMiddleware.ensureAuth, exportacaoController.exportarUsuario);
router.get('/contagens', authMiddleware.ensureAuth, exportacaoController.listarContagens);
router.put('/contagens/:id', authMiddleware.ensureAuth, exportacaoController.atualizarContagem);
router.delete('/resetar-produtos', authMiddleware.ensureAuth, exportacaoController.resetarProdutos);

module.exports = router;
