// db/oracle.js
const oracledb = require('oracledb');
require('dotenv').config({ override: true });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function init() {
  await oracledb.createPool({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECTSTRING,
    poolMin: 1,
    poolMax: 4,
    poolIncrement: 1
  });
}

function close() {
  return oracledb.getPool().close(0);
}

async function simpleExecute(sql, binds = {}, opts = {}) {
  const pool = oracledb.getPool();
  const conn = await pool.getConnection();
  try {
    const result = await conn.execute(sql, binds, { autoCommit: true, ...opts });
    return result;
  } finally {
    await conn.close();
  }
}

module.exports = { init, close, simpleExecute };
