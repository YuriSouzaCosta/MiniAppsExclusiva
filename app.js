const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const coletorRoutes = require('./routes/coletorRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const contagemRoutes = require('./routes/contagemRoutes');
const exportacaoRoutes = require('./routes/exportacaoRoutes');
const controleCartaoRoutes = require('./routes/controleCartaoRoutes');
const calculadoraCustoRoutes = require('./routes/calculadoraCustoRoutes');
const consultaProdutosRoutes = require('./routes/consultaProdutosRoutes');
const pedidoComprasRoutes = require('./routes/pedidos/pedidoComprasRoutes');
const transferenciasRoutes = require('./routes/transferencias/transferenciasRoutes');
const homeRoutes = require('./routes/homeRoutes');

// Import Middleware
const authMiddleware = require('./middleware/authMiddleware');

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

// rota principal (menu/index) após login
app.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  let minhaVariavel;

  console.log('Base URL:', baseUrl);

  // Detectar ambiente com base no host e NODE_ENV
  if (process.env.NODE_ENV === 'development' || baseUrl.includes('localhost')) {
    // Ambiente de desenvolvimento (localhost) - usa a URL com porta
    minhaVariavel = baseUrl;
  } else {
    // Qualquer outro ambiente - vai direto para o domínio de produção
    minhaVariavel = 'https://appexclusiva.innube.com.br';
  }

  console.log('minhaVariavel definida como:', minhaVariavel);

  res.render('menu', { user: req.user, minhaVariavel });
});

app.use('/', coletorRoutes);
app.use('/produto', produtoRoutes);
app.use('/contagem', contagemRoutes);
app.use('/exportacao', exportacaoRoutes);
app.use('/controle-cartao', controleCartaoRoutes);
app.use('/calculadora-custo', calculadoraCustoRoutes);
app.use('/consulta-produtos', consultaProdutosRoutes);
app.use('/', pedidoComprasRoutes);
app.use('/transferencias', transferenciasRoutes);
app.use('/', homeRoutes);
app.use('/', coletorRoutes);

const db = require('./config/db/oracle');

// Initialize Database and Start Server
async function startServer() {
  try {
    await db.init();
    console.log('Banco de dados Oracle conectado');

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (err) {
    console.error('Erro ao inicializar banco de dados:', err);
    process.exit(1);
  }
}

startServer();