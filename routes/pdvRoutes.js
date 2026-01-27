const express = require('express');
const router = express.Router();
const pdvController = require('../controllers/pdvController');
const authMiddleware = require('../middleware/authMiddleware');

// Public Routes (Login)
router.get('/login', pdvController.getPdvLogin);
router.post('/login', pdvController.postPdvLogin);

// Ensure all PDV routes are protected
router.use(authMiddleware.ensureAuth);

// Manager Routes
router.get('/manager', pdvController.getManagerDashboard);

// Salesperson Routes
router.get('/sales', pdvController.getSalesDashboard);
router.get('/pos', pdvController.getNewOrder);

// API Routes
router.post('/order', pdvController.postOrder);
router.get('/partners', pdvController.searchPartners);

module.exports = router;
