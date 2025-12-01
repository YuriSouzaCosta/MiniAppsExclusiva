// db/oracle.js
const oracledb = require('oracledb');
const util = require('util');
require('dotenv').config();

// Polyfill para util.isDate removido em versões recentes do Node.js
// Necessário para compatibilidade com oracledb 5.3.0
if (!util.isDate) {
  util.isDate = (d) => d instanceof Date;
}

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

async function getConnection() {
  return await oracledb.getConnection();
}

async function close() {
  return await oracledb.getPool().close(0);
}

const simpleExecute = async (query, binds = {}, options = {}) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(query, binds, options);
    return result;
  } catch (err) {
    console.error('Erro na execução da consulta:', err);
    throw err;
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Erro ao fechar a conexão:', err);
      }
    }
  }
};

module.exports = {
  init,
  getConnection,
  close,
  simpleExecute
};
