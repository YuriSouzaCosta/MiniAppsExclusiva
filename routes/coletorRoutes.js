// routes/coletorRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// Rota de visualização da página “Coletor”
router.get('/coletor', authMiddleware.ensureAuth, (req, res) => {
  // Você pode ajustar “casoUsuario” conforme sua lógica
  const casoUsuario = null;
  res.render('coletor', {
    user: req.user,
    casoUsuario
  });
});

module.exports = router;
