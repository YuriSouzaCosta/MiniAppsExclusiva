// scripts/create_user.js
const bcrypt = require('bcrypt');
const db = require('../db/oracle');
require('dotenv').config();

async function run() {
  await db.init();
  const username = process.argv[2]; // exemplo: node create_user.js admin senha123
  const password = process.argv[3];
  const roleName = process.argv[4] || 'admin';

  if (!username || !password) {
    console.log('Uso: node create_user.js <username> <password> [role]');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  // buscar role id
  const r = await db.simpleExecute('SELECT id FROM roles WHERE name = :r', { r: roleName });
  let roleId;
  if (r.rows && r.rows.length) roleId = r.rows[0][0];
  else {
    const ins = await db.simpleExecute('INSERT INTO roles (name) VALUES (:n) RETURNING id INTO :id', {
      n: roleName, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    });
    roleId = ins.outBinds.id[0];
  }

  await db.simpleExecute(
    'INSERT INTO users (username, password_hash, role_id) VALUES (:u, :p, :r)',
    { u: username, p: hash, r: roleId }
  );

  console.log('Usuário criado:', username);
  process.exit(0);
}

run().catch(e=>{console.error(e); process.exit(1);});
