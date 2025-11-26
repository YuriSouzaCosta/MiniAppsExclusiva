// app.js (trechos)
require('dotenv').config({ override: true });

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const db = require('./config/db/oracle');

const authController = require('./controllers/authController');
const authMiddleware = require('./middleware/authMiddleware');
const { authenticate, generateToken, ensureAuth, requireRole, COOKIE_NAME } = require('./middleware/authMiddleware');

const coletorRoutes = require('./routes/coletorRoutes');
const homeRoutes = require('./routes/homeRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const contagemRoutes = require('./routes/contagemRoutes');
const authRoutes = require('./routes/authRoutes');
const exportacaoRoutes = require('./routes/exportacaoRoutes');
const controleCartaoRoutes = require('./routes/controleCartaoRoutes');
const calculadoraCustoRoutes = require('./routes/calculadoraCustoRoutes');
const consultaProdutosRoutes = require('./routes/consultaProdutosRoutes');
const pedidoComprasRoutes = require('./routes/pedidoComprasRoutes');



const app = express();
const PORT = process.env.PORT || 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());



// inicializa pool Oracle
db.init().catch(err => {
  console.error('Erro Oracle:', err); process.exit(1);
});

// proteger todas as rotas abaixo
app.use('/', authRoutes);


// middleware para proteger rotas depois do login
app.use((req, res, next) => {
  const publicPaths = ['/login', '/css', '/js', '/public', '/auth', '/coletor'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  return authMiddleware.ensureAuth(req, res, next);
});
