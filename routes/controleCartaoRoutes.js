const express = require('express');
const router = express.Router();
const controleCartaoController = require('../controllers/controleCartaoController');
const { ensureAuth } = require('../middleware/authMiddleware');

router.use(ensureAuth);

router.get('/', controleCartaoController.index);
router.get('/novo', controleCartaoController.create);
router.post('/novo', controleCartaoController.store);
router.get('/pendentes', controleCartaoController.listPending);

module.exports = router;
