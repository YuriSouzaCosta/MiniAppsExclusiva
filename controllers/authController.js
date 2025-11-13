const db = require('../config/db/oracle');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

async function authenticate(username, password) {
  let conn;
  console.log('Dados recebidos no login:', username, ' SENHA : ', password != null ? password : '(sem senha)');
  try {
    // Obter conexão com o banco de dados
    conn = await db.getConnection(); // Alterado para obter a conexão corretamente

    console.log('authenticate: buscando usuário:', username);
    const usuario_uc = username.toUpperCase();
    const query = `
      SELECT NOMEUSU AS NOMEUSU, AD_SENHA AS AD_SENHA, AD_ROLE AS AD_ROLE
      FROM TSIUSU
      WHERE NOMEUSU = :usuario_uc AND AD_SENHA = :password
    `;
    const binds = { usuario_uc, password };

    console.log('Autenticando com:', binds);
    const result = await conn.execute(query, binds);

    if (!result.rows || result.rows.length === 0) {
      console.log('authenticate: usuário não encontrado ou senha inválida');
      return null;
    }

    const userRow = result.rows[0];
    console.log('authenticate: encontrado usuário:', userRow);

    const nomeusu = userRow.NOMEUSU;
    const senhaBanco = userRow.AD_SENHA;
    const ad_role = userRow.AD_ROLE;

    // Se for senha em texto puro:
    if (password !== senhaBanco) {
      console.log('Senha inválida. Digitado:', password, 'Banco:', senhaBanco);
      return null;
    }

    // Busca nome bonito da role
    const roleRes = await conn.execute(
      `SELECT OPCAO
         FROM TDDOPC
        WHERE NUCAMPO = 9999990154
          AND VALOR = :role`,
      [ad_role]
    );

    let roleName = ad_role;
    if (roleRes.rows && roleRes.rows.length > 0) {
      roleName = roleRes.rows[0].OPCAO;
    }

    console.log('authenticate: papel:', ad_role, 'nome da role:', roleName);

    return {
      username: nomeusu,
      role: ad_role,
      roleName
    };

  } catch (err) {
    console.error('authenticate: erro no banco:', err);
    throw err;

  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (e) {
        console.error('Erro ao fechar a conexão:', e);
      }
    }
  }
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

async function postLogin(req, res) {
  const { username, password } = req.body;
  console.log('postLogin: login solicitado para:', username);
  try {
    const user = await authenticate(username, password);

    if (!user) {
      console.log('postLogin: autenticação falhou para:', username);
      return res.render('login', { error: 'Usuário ou senha inválidos', next: req.body.next || '/' });
    }

    console.log('postLogin: autenticação bem-sucedida para:', username, 'role:', user.role);

    const token = generateToken({ username: user.username, role: user.role });

    // Configuração manual do cookie
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true, // O cookie não pode ser acessado via JavaScript no cliente
      secure: false, // Apenas em HTTPS em produção
      sameSite: 'lax', // Proteção contra CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias em milissegundos
    });

    console.log('postLogin: token gerado e cookie enviado para:', username, 'Token:', token);

    return res.redirect('http://exclusiva.intranet:8080/home/');
  } catch (err) {
    console.error('postLogin: erro no login:', err);
    return res.render('login', { error: 'Erro interno no servidor', next: req.body.next || '/' });
  }
}

function postLogout(req, res) {
  res.clearCookie(COOKIE_NAME);
  return res.redirect('/login');
}

function ensureAuth(req, res, next) {
  const token = req.cookies[process.env.COOKIE_NAME || 'auth_token'];

  if (!token) {
    console.log('ensureAuth(): cookie não encontrado, redirecionando para login');
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Adiciona os dados do usuário à requisição
    next();
  } catch (err) {
    console.log('ensureAuth(): token inválido, redirecionando para login');
    return res.redirect('/login');
  }
}

module.exports = {
  postLogin,
  postLogout,
  ensureAuth
};