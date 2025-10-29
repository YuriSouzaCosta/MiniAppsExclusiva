// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', (req, res) => {
  res.render('login', { error: null, next: req.query.next || '/' });
});

router.post('/login', authController.postLogin);
router.post('/logout', authController.postLogout);

module.exports = router;
