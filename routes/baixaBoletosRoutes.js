// routes/baixaBoletosRoutes.js
// Rotas do módulo "Baixa de Boletos por PDF" (somente ADMIN)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/baixaBoletosController');
const { ensureAuth, requireRole } = require('../middleware/authMiddleware');

// ----- Configuração Multer: upload de PDFs de boleto -----
const storageBoletos = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'boletos'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const nome = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/_+/g, '_');
    cb(null, `${timestamp}_${nome}`);
  }
});

const EXT_PERMITIDAS = ['.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tif', '.tiff'];

const uploadBoletos = multer({
  storage: storageBoletos,
  limits: { fileSize: 10 * 1024 * 1024 },  // 10 MB por arquivo
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXT_PERMITIDAS.includes(ext)) return cb(null, true);
    cb(new Error('Formato não suportado. Use PDF ou imagem (JPG/PNG/BMP/TIFF/WEBP)'));
  }
});

// protege todas as rotas com login e restringe para ADMIN + Compras (ASS_COMPRA)
router.use(ensureAuth);
router.use(requireRole('ADMIN', 'ASS_COMPRA'));

// Página
router.get('/', ctrl.pagina);

// API — processamento principal
router.post('/api/upload', uploadBoletos.array('arquivos', 20), (err, req, res, next) => {
  if (err) return res.status(400).json({ ok: false, erro: err.message });
  next();
}, ctrl.apiUpload);
router.post('/api/baixar', ctrl.apiBaixar);
router.get('/api/historico', ctrl.apiHistorico);

// API — contas bancárias disponíveis (seletor de conta na baixa)
router.get('/api/contas', ctrl.apiListarContas);

// API — dados do parceiro por CODPARC (auto-fill da revisão)
router.get('/api/parceiro/:codparc', ctrl.apiBuscarParceiro);

// API — busca títulos em aberto por CODPARC (seleção manual de NUFIN)
router.post('/api/buscar-por-codparc', ctrl.apiBuscarPorCodparc);

// API — mapeamento CNPJ boleto → CNPJ nota (fornecedor com dois CNPJs)
router.get('/api/mapeamentos',       ctrl.apiListarMapeamentos);
router.post('/api/mapeamentos',      ctrl.apiCriarMapeamento);
router.delete('/api/mapeamentos/:id', ctrl.apiExcluirMapeamento);

module.exports = router;
