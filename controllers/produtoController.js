// controllers/produtoController.js
const db = require('../config/db/oracle');
const oracledb = require('oracledb');

exports.getProdutoByCodigo = async (req, res) => {
  const { codigo_barra } = req.params;
  try {
    const result = await db.simpleExecute(
      `SELECT nome, preco, referencia
         FROM VW_PRODUTOS_BLC
        WHERE codigo_barra = :codigo_barra`,
      { codigo_barra: String(codigo_barra) }
    );
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      res.json(row);
    } else {
      res.status(404).json({ error: "Produto não encontrado" });
    }
  } catch (err) {
    console.error("Erro ao consultar o banco de dados:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.postContagem = async (req, res) => {
  const { codigo_barra, quantidade, usuario } = req.body;
  if (!codigo_barra || !quantidade || !usuario) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }
  try {
    // Converte explicitamente para tipos primitivos para evitar problemas com oracledb
    const params = {
      codigo_barra: String(codigo_barra),
      quantidade: Number(quantidade),
      usuario: String(usuario),
      id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };

    const result = await db.simpleExecute(
      `INSERT INTO AD_CONTAGENS (codigo_barra, quantidade, usuario)
         VALUES (:codigo_barra, :quantidade, :usuario)
         RETURNING id INTO :id`,
      params,
      { autoCommit: true }
    );
    const novoId = result.outBinds.id[0];
    res.json({ message: "Contagem salva com sucesso", id: novoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar contagem" });
  }
};
