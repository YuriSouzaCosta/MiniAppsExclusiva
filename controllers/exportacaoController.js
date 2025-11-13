// controllers/exportacaoController.js
const db = require('../config/db/oracle');
const ExcelJS = require('exceljs');

exports.exportarContagens = async (req, res) => {
  const { usuario } = req.params;
  const nomeArquivo = req.query.nomeArquivo || `contagens_${usuario}`;

  if (!usuario) {
    return res.status(400).json({ error: "Usuário não especificado." });
  }

  try {
    // Busca as contagens do usuário
    const result = await db.simpleExecute(
      `SELECT p.codprod, c.id, c.codigo_barra, p.nome, p.preco, c.quantidade, c.usuario
         FROM AD_CONTAGENS c
         JOIN VW_PRODUTOS_BLC p ON c.codigo_barra = p.codigo_barra
        WHERE LOWER(c.usuario) = :usuario
          AND c.situacao IS NULL
        ORDER BY c.id DESC`,
      { usuario: usuario.toLowerCase() }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Nenhuma contagem encontrada para exportar." });
    }

    // Cria o workbook e a planilha
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Contagens');

    // Cabeçalhos
    sheet.columns = [
      { header : 'Cód. Produto', key: 'CODPROD', width: 15 },
      { header: 'ID', key: 'ID', width: 10 },
      { header: 'Código de Barras', key: 'CODIGO_BARRA', width: 25 },
      { header: 'Nome do Produto', key: 'NOME', width: 40 },
      { header: 'Preço', key: 'PRECO', width: 15 },
      { header: 'Quantidade', key: 'QUANTIDADE', width: 15 },
      { header: 'Usuário', key: 'USUARIO', width: 20 }
    ];

    // Linhas de dados
    result.rows.forEach(row => sheet.addRow(row));

    // Cabeçalho em negrito
    sheet.getRow(1).font = { bold: true };

    // Gera o arquivo em memória
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}.xlsx`);
    res.send(buffer);

  } catch (err) {
    console.error('Erro ao exportar contagens:', err);
    res.status(500).json({ error: "Erro ao exportar contagens." });
  }
};
