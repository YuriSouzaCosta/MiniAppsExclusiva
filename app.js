// app.js (trechos)
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./config/db/oracle');
const authController = require('./controllers/authController');
const authMiddleware = require('./middleware/authMiddleware');
const { authenticate, generateToken, ensureAuth, requireRole, COOKIE_NAME } = require('./middleware/authMiddleware');
require('dotenv').config({ override: true });

const produtoRoutes = require('./routes/produtoRoutes');
const contagemRoutes = require('./routes/contagemRoutes');
const exportacaoRoutes = require('./routes/exportacaoRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());


// inicializa pool Oracle
db.init().catch(err => {
  console.error('Erro Oracle:', err); process.exit(1);
});

// proteger todas as rotas abaixo
app.use('/', authRoutes);

// middleware para proteger rotas depois do login
app.use((req, res, next) => {
	const publicPaths = ['/login', '/css', '/js', '/public', '/auth'];
	if (publicPaths.some(p => req.path.startsWith(p))) {
	  return next();
	}
	return authMiddleware.ensureAuth(req, res, next);
  });

// rota principal (menu/index) após login
app.get('/', (req, res) => {
	const baseUrl = `${req.protocol}://${req.get('host')}`;
	let minhaVariavel = baseUrl;
	if (baseUrl.startsWith('http://exclusiva.intranet:8080')) {
	  minhaVariavel = 'http://exclusiva.intranet';
	} else if (baseUrl.startsWith('http://exclusivarua4.duckdns.org:8080')) {
	  minhaVariavel = 'http://exclusivarua4.duckdns.org';
	}
	res.render('menu', { user: req.user, minhaVariavel });
  });
  

app.use('/produto', produtoRoutes);
app.use('/contagem', contagemRoutes);
app.use('/exportacao', exportacaoRoutes);
  
app.listen(PORT, () => {
	console.log(`Servidor rodando na porta ${PORT}`);
});