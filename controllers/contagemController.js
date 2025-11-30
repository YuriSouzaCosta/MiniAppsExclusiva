// controllers/contagemController.js
const db = require('../config/db/oracle');
const oracledb = require('oracledb');

exports.createContagem = async (req, res) => {
  const { codigo_barra, quantidade, usuario } = req.body;
  if (!codigo_barra || !quantidade || !usuario) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }
  try {
    const result = await db.simpleExecute(
      `INSERT INTO AD_CONTAGENS (codigo_barra, quantidade, usuario)
         VALUES (:codigo_barra, :quantidade, :usuario)
         RETURNING id INTO :id`,
      {
        codigo_barra,
        quantidade,
        usuario,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );
    const novoId = result.outBinds.id[0];
    res.json({ message: "Contagem salva com sucesso", id: novoId });
  } catch (err) {
    console.error('createContagem erro:', err);
    res.status(500).json({ error: "Erro ao salvar contagem" });
  }
};

exports.listContagens = async (req, res) => {
  const usuarioHeader = req.headers['authorization'];
  if (!usuarioHeader) {
    return res.status(400).json({ error: "Usuário não especificado no cabeçalho" });
  }
  try {
    const result = await db.simpleExecute(
      `SELECT c.id, c.codigo_barra, p.nome, p.preco, c.quantidade, c.usuario
         FROM AD_CONTAGENS c
         JOIN VW_PRODUTOS_BLC p ON c.codigo_barra = p.codigo_barra
        WHERE LOWER(c.usuario) = :usuario
          AND c.situacao IS NULL
        ORDER BY c.id DESC`,
      { usuario: usuarioHeader.toLowerCase() }
    );
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Nenhuma contagem encontrada para este usuário" });
    }
    res.json(result.rows);
  } catch (err) {
    console.error('listContagens erro:', err);
    res.status(500).json({ error: "Erro ao buscar contagens" });
  }
};

exports.getContagensByUsuario = async (req, res) => {
  const { usuario } = req.params;
  try {
    const result = await db.simpleExecute(
      `SELECT c.id, c.codigo_barra, p.nome, p.preco, c.quantidade, c.usuario
         FROM AD_CONTAGENS c
         JOIN VW_PRODUTOS_BLC p ON c.codigo_barra = p.codigo_barra
        WHERE LOWER(c.usuario) = :usuario
          AND c.situacao IS NULL
        ORDER BY c.id DESC`,
      { usuario: usuario.toLowerCase() }
    );
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Nenhuma contagem encontrada para o usuário especificado" });
    }
    res.json(result.rows);
  } catch (err) {
    console.error('getContagensByUsuario erro:', err);
    res.status(500).json({ error: "Erro ao buscar contagens por usuário" });
  }
};

exports.deleteContagensByUsuario = async (req, res) => {
  const { usuario } = req.params;
  try {
    await db.simpleExecute(
      `UPDATE AD_CONTAGENS SET SITUACAO = 'E'
         WHERE LOWER(usuario) = :usuario`,
      { usuario: usuario.toLowerCase() }
    );
    res.json({ message: "Todas as contagens foram zeradas com sucesso." });
  } catch (err) {
    console.error('deleteContagensByUsuario erro:', err);
    res.status(500).json({ error: "Erro ao zerar as contagens" });
  }
};

exports.updateQuantidade = async (req, res) => {
  const { id } = req.params;
  const { quantidade } = req.body;

  if (!id || quantidade === undefined) {
    return res.status(400).json({ error: "ID e quantidade são obrigatórios." });
  }

  try {
    const result = await db.simpleExecute(
      `UPDATE AD_CONTAGENS
          SET quantidade = :quantidade
        WHERE id = :id`,
      {
        quantidade: Number(quantidade),
        id: Number(id)
      },
      { autoCommit: true }
    );

    // Verifica se alguma linha foi realmente atualizada
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: "Contagem não encontrada para o ID informado." });
    }

    res.json({ message: "Quantidade atualizada com sucesso." });
  } catch (err) {
    console.error('updateQuantidade erro:', err);
    res.status(500).json({ error: "Erro ao atualizar quantidade da contagem." });
  }
};
