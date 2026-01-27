// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const db = require('../config/db/oracle');
require('dotenv').config({ override: true });

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token';

// Função que autentica usuário com sua tabela TSIUSU
async function authenticate(username, password) {
  if (!username) {
    console.log('authenticate(): username vazio ou indefinido');
    return null;
  }
  const usuario_uc = username.toUpperCase();

  try {
    console.log('authenticate(): solicitando usuário', usuario_uc);

    const result = await db.simpleExecute(
      `SELECT NOMEUSU as nomeusu, AD_SENHA as ad_senha, AD_ROLE as ad_role
           FROM TSIUSU
          WHERE UPPER(NOMEUSU) =:usuario_uc`,
      { usuario_uc }  // bind tem que exatamente esse nome
    );

    if (!result.rows || result.rows.length === 0) {
      console.log('authenticate(): usuário não encontrado:', usuario_uc);
      return null;
    }



    const row = result.rows[0];
    const nomeusu = row.NOMEUSU;
    const senhaBanco = row.AD_SENHA;
    const ad_role = row.AD_ROLE;

    console.log('authenticate(): encontrado registro:', { nomeusu, senhaBanco, ad_role });

    if (!password) {
      console.log('authenticate(): senha vazia');
      return null;
    }
    if (password !== senhaBanco) {
      console.log('authenticate(): senha inválida. Digitado:', password, 'Banco:', senhaBanco);
      return null;
    }

    const roleRes = await db.simpleExecute(
      `SELECT OPCAO
           FROM TDDOPC
          WHERE NUCAMPO = 9999990154
            AND VALOR = :role`,
      { role: ad_role }
    );

    const roleName = (roleRes.rows && roleRes.rows.length > 0)
      ? roleRes.rows[0].OPCAO
      : ad_role;

    console.log('authenticate(): papel retornado:', ad_role, 'nome da role:', roleName);

    return {
      username: nomeusu,
      role: ad_role,
      roleName
    };

  } catch (err) {
    console.error('authenticate(): erro no banco:', err);
    throw err;
  }
}


// Função que autentica usuário para o PDV usando a view VW_LISTFUNCIONARIOS_VENDAS_YSC
async function authenticatePdv(username, password) {
  if (!username) {
    console.log('authenticatePdv(): username vazio ou indefinido');
    return null;
  }
  const usuario_uc = username.toUpperCase();

  try {
    console.log('authenticatePdv(): solicitando usuário', usuario_uc);

    const result = await db.simpleExecute(
      `SELECT APELIDO, AD_SENHA, TIPVEND, CODVEND
           FROM VW_LISTFUNCIONARIOS_VENDAS_YSC
          WHERE UPPER(APELIDO) = :usuario_uc`,
      { usuario_uc }
    );

    if (!result.rows || result.rows.length === 0) {
      console.log('authenticatePdv(): usuário não encontrado:', usuario_uc);
      return null;
    }

    const row = result.rows[0];
    const apelido = row.APELIDO;
    const senhaBanco = row.AD_SENHA;
    const tipvend = row.TIPVEND; // V, G, C
    const codvend = row.CODVEND;
    const nomevend = row.APELIDO;

    if (!password) {
      console.log('authenticatePdv(): senha vazia');
      return null;
    }

    if (password !== senhaBanco) {
      console.log('authenticatePdv(): senha inválida');
      return null;
    }

    // Mapear TIPVEND para roles
    let role;
    let roleName;
    if (tipvend === 'V') {
      role = 'VENDEDOR';
      roleName = 'Vendedor';
    } else if (tipvend === 'G') {
      role = 'GERENTE';
      roleName = 'Gerente';
    } else if (tipvend === 'C') {
      role = 'ADMIN';
      roleName = 'Administrador';
    } else {
      role = 'USER';
      roleName = 'Usuário';
    }

    return {
      username: apelido,
      role: role,
      roleName: roleName,
      codvend: codvend,
      nome: nomevend
    };

  } catch (err) {
    console.error('authenticatePdv(): erro no banco:', err);
    throw err;
  }
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}

// Middleware que verifica o cookie e popula req.user
function ensureAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    console.log('ensureAuth(): cookie não encontrado, redirecionando para login');
    if (req.originalUrl.startsWith('/pdv')) {
      return res.redirect('/pdv/login?next=' + encodeURIComponent(req.originalUrl));
    }
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    console.log('ensureAuth(): token válido para usuário:', payload.username, 'role:', payload.role);
    next();
  } catch (err) {
    console.log('ensureAuth(): token inválido ou expirado:', err.message);
    if (req.originalUrl.startsWith('/pdv')) {
      return res.redirect('/pdv/login?next=' + encodeURIComponent(req.originalUrl));
    }
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
}

// Middleware para checar role
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      console.log('requireRole(): usuário não autenticado');
      return res.status(401).send('Not authenticated');
    }
    if (!allowedRoles.includes(req.user.role)) {
      console.log('requireRole(): usuário', req.user.username, 'com role', req.user.role, 'tenta acessar role permitida', allowedRoles);
      return res.status(403).send('Access denied');
    }
    next();
  };
}

module.exports = {
  authenticate,
  authenticatePdv,
  generateToken,
  ensureAuth,
  requireRole,
  COOKIE_NAME
};
