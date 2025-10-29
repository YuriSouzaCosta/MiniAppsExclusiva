// controllers/exportacaoController.js
const db = require('../config/db/oracle');
const oracledb = require('oracledb');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

exports.exportarUsuario = async (req, res) => {
  const { usuario } = req.params;
  const nomeArquivo = req.query.nomeArquivo || 'contagens';
  try {
    const result = await db.simpleExecute(
      `SELECT c.id, p.codprod, c.codigo_barra, c.quantidade, p.nome, p.preco
         FROM AD_CONTAGENS c
         JOIN VW_PRODUTOS_BLC p ON c.codigo_barra = p.codigo_barra
        WHERE LOWER(c.usuario) = :usuario
          AND c.situacao IS NULL`,
      { usuario: usuario.toLowerCase() }
    );
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Nenhuma contagem encontrada para o usuário especificado" });
    }

    const dados = result.rows.map(row => ({
      ID: row.ID,
      CODPROD: row.CODPROD,
      "Código de Barra": row.CODIGO_BARRA,
      Produto: row.NOME,
      Preço: row.PRECO.toFixed(2),
      Quantidade: row.QUANTIDADE
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(dados);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Contagens');

    const fileName = `${nomeArquivo}.xlsx`;
    const filePath = path.join(__dirname, '../tmp', fileName);

    xlsx.writeFile(workbook, filePath);

    await db.simpleExecute(
      `UPDATE AD_CONTAGENS
         SET situacao = 'E'
       WHERE LOWER(usuario) = :usuario
         AND situacao IS NULL`,
      { usuario: usuario.toLowerCase() }
    );

    res.download(filePath, fileName, err => {
      if (err) {
        console.error('Erro ao enviar o arquivo:', err);
        return res.status(500).send("Erro ao enviar o arquivo");
      }
      fs.unlink(filePath, unlinkErr => {
        if (unlinkErr) console.error('Erro ao remover arquivo temporário:', unlinkErr);
      });
    });

  } catch (err) {
    console.error('exportarUsuario erro:', err);
    res.status(500).json({ error: "Erro na exportação" });
  }
};

exports.atualizarContagem = async (req, res) => {
  const { id } = req.params;
  const { quantidade } = req.body;

  if (!quantidade) {
    return res.status(400).json({ error: "Quantidade é obrigatória" });
  }
  try {
    const result = await db.simpleExecute(
      `UPDATE AD_CONTAGENS
          SET quantidade = :quantidade
        WHERE id = :id`,
      { quantidade, id },
      { autoCommit: true }
    );
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: "Contagem não encontrada" });
    }
    res.json({ message: "Contagem atualizada com sucesso." });
  } catch (err) {
    console.error('atualizarContagem erro:', err);
    res.status(500).json({ error: "Erro ao atualizar a contagem" });
  }
};

exports.resetarProdutos = async (req, res) => {
  try {
    await db.simpleExecute(`DELETE FROM AD_CONTAGENS`, {}, { autoCommit: true });
    res.json({ message: "Contagens apagadas com sucesso" });
  } catch (err) {
    console.error('resetarProdutos erro:', err);
    res.status(500).json({ error: "Erro ao resetar produtos" });
  }
};

exports.listarContagens = async (req, res) => {
  try {
    const result = await db.simpleExecute(
      `SELECT c.id, c.codigo_barra, p.nome, p.preco, c.quantidade, c.usuario
         FROM AD_CONTAGENS c
         JOIN VW_PRODUTOS_BLC p ON c.codigo_barra = p.codigo_barra
        WHERE c.situacao IS NULL
        ORDER BY c.id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listarContagens erro:', err);
    res.status(500).json({ error: "Erro ao listar contagens" });
  }
};
