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
router.get('/my-orders', pdvController.getMyOrders);

// API Routes
router.post('/create-header', pdvController.createOrderHeader);
router.post('/order', pdvController.postOrder);
router.get('/products', pdvController.searchProducts);
router.get('/marcas', pdvController.getMarcas);
router.get('/partners', pdvController.searchPartners);
router.get('/partners', pdvController.searchPartners);
router.get('/payment-methods', pdvController.getPaymentMethods);
router.get('/order-details', pdvController.getOrderDetails);

module.exports = router;
