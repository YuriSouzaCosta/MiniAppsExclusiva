// app.js (trechos)
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./config/db/oracle');
const authController = require('./controllers/authController');
const authMiddleware = require('./middleware/authMiddleware');
const { authenticate, generateToken, ensureAuth, requireRole, COOKIE_NAME } = require('./middleware/authMiddleware');
require('dotenv').config({ override: true });




const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.set('view engine', 'ejs');

// inicializa pool Oracle
db.init().catch(err => {
  console.error('Erro Oracle:', err); process.exit(1);
});

// rota pública de login
app.get('/login', (req, res) => {
  res.render('login', { error: null, next: req.query.next || '/' });
});

app.post('/login', authController.postLogin);

app.post('/logout', (req, res) => {
	authController.postLogout(req, res);
  });

// proteger todas as rotas abaixo
app.use((req, res, next) => {
	const publicPaths = ['/login', '/css', '/js', '/public'];
	if (publicPaths.some(p => req.path.startsWith(p))) return next();
	return authMiddleware.ensureAuth(req, res, next);
  });

// rota index protegida
app.get('/', (req, res) => {
	// Aqui você pode calcular ‘minhaVariavel’ conforme lógica que você tinha
	const baseUrl = `${req.protocol}://${req.get('host')}`;

	// se você quiser tratar casos específicos como PHP fazia:
	let minhaVariavel = baseUrl;
	if (baseUrl.startsWith('http://exclusiva.intranet:8080')) {
		minhaVariavel = 'http://exclusiva.intranet';
	}
	else if (baseUrl.startsWith('http://exclusivarua4.duckdns.org:8080')) {
		minhaVariavel = 'http://exclusivarua4.duckdns.org';
	}
	res.render('menu', {
	  user: req.user,         // via token já populado
	  minhaVariavel
	});
  });

// exemplo de rota com role admin only
app.get('/admin', authMiddleware.requireRole('ADMIN'), (req, res) => {
	res.render('admin', { user: req.user });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
	console.log(`Servidor rodando na porta ${PORT}`);
  });