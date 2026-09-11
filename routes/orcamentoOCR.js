// routes/orcamentoOCR.js
// =============================================================
// Rotas do módulo Orçamento OCR
// Configura Multer para upload de imagens e templates Excel
// =============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const controller = require('../controllers/orcamentoOCRController');
const { ensureAuth } = require('../middleware/authMiddleware');

// ----- Configuração Multer: Upload de IMAGENS -----
const storageImagens = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'imagens'));
  },
  filename: (req, file, cb) => {
    // Gera nome único: timestamp + nome original sanitizado
    const timestamp = Date.now();
    const nomeOriginal = file.originalname
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')  // Remove chars especiais
      .replace(/_+/g, '_');                 // Colapsa underscores
    cb(null, `${timestamp}_${nomeOriginal}`);
  }
});

const uploadImagem = multer({
  storage: storageImagens,
  limits: {
    fileSize: 10 * 1024 * 1024  // 10 MB máximo
  },
  fileFilter: (req, file, cb) => {
    const extensoesPermitidas = /\.(jpg|jpeg|png|bmp|tiff|tif|webp)$/i;
    const mimesPermitidos = /^image\/(jpeg|png|bmp|tiff|webp)$/;

    const extOk = extensoesPermitidas.test(path.extname(file.originalname));
    const mimeOk = mimesPermitidos.test(file.mimetype);

    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagem não suportado. Use: JPG, PNG, BMP, TIFF ou WEBP'));
    }
  }
});


// ----- Configuração Multer: Upload de MODELOS Excel -----
const storageModelos = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'modelos'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const nomeOriginal = file.originalname
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')
      .replace(/_+/g, '_');
    cb(null, `${timestamp}_${nomeOriginal}`);
  }
});

const uploadModelo = multer({
  storage: storageModelos,
  limits: {
    fileSize: 5 * 1024 * 1024  // 5 MB máximo
  },
  fileFilter: (req, file, cb) => {
    const extOk = /\.xlsx$/i.test(path.extname(file.originalname));
    const mimeOk = /officedocument\.spreadsheetml|application\/vnd\.ms-excel/.test(file.mimetype);

    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .xlsx são aceitos'));
    }
  }
});


// =============================================================
// Middleware de erro do Multer
// =============================================================
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Arquivo muito grande. Tamanho máximo: 10MB (imagens) / 5MB (modelos)'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Erro no upload: ${err.message}`
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next();
}


// =============================================================
// ROTAS
// Todas protegidas por autenticação
// =============================================================
router.use(ensureAuth);

// Página principal
router.get('/', controller.index);

// API: Listar modelos cadastrados (JSON)
router.get('/modelos', controller.listarModelos);

// API: Listar histórico de processamentos (JSON)
router.get('/historico', controller.listarHistorico);

// Upload de template Excel
router.post('/upload-modelo',
  uploadModelo.single('arquivo'),
  handleMulterError,
  controller.uploadModelo
);

// Processar imagem com OCR
router.post('/processar',
  uploadImagem.single('imagem'),
  handleMulterError,
  controller.processarImagem
);

// Download de arquivo gerado
router.get('/download/:arquivo', controller.downloadArquivo);

// Deletar modelo
router.delete('/modelo/:id', controller.deletarModelo);


module.exports = router;
