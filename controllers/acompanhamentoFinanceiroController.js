// controllers/acompanhamentoFinanceiroController.js
// Acompanhamento Financeiro (contas a PAGAR): boletos e titulos das notas de
// ENTRADA (compras) para fornecedores. Vem de TGFFIN (RECDESP=-1) cruzando
// TGFCAB (nota) e TGFPAR (fornecedor). Traz parcela, valor, emissao, vencimento,
// numero da nota, fornecedor e situacao (aberto/pago via DHBAIXA).
// 100% do banco (Sankhya/Oracle). Segue o padrao dos modulos faturamento/acompanhamento-notas.
const path = require('path');
const db = require('../config/db/oracle');

const TOP_ENTRADA = [5, 6];               // TOPs de entrada (compra)
const TOPS_SQL = TOP_ENTRADA.join(',');

function paginaIndex(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'acompanhamentoFinanceiro', 'index.html'));
}

function validData(s, padrao) {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return padrao;
}

// Lista os titulos a pagar (uma linha por parcela) com vencimento no periodo.
async function apiDados(req, res) {
  try {
    const hoje = new Date();
    const iso = d => d.toISOString().slice(0, 10);
    const defIni = new Date(hoje.getTime() - 30 * 86400000);
    const defFim = new Date(hoje.getTime() + 60 * 86400000);
    const di = validData(req.query.dt_ini, iso(defIni));
    const df = validData(req.query.dt_fin, iso(defFim));

    const sql = `
      SELECT cab.CODEMP,
             NVL(emp.NOMEFANTASIA, emp.RAZAOSOCIAL) EMPRESA,
             cab.NUMNOTA, f.NUNOTA,
             f.DESDOBRAMENTO PARC,
             (SELECT COUNT(*) FROM TGFFIN f2
               WHERE f2.NUNOTA = f.NUNOTA AND f2.RECDESP = -1
                 AND NVL(f2.PROVISAO,'N') = 'N') NPARC,
             p.NOMEPARC FORNECEDOR, p.CGC_CPF CNPJ,
             NVL(f.VLRDESDOB,0) VALOR,
             cab.DTNEG EMISSAO, f.DTVENC VENCIMENTO, f.DHBAIXA BAIXA,
             t.DESCRTIPTIT TIPO, f.NOSSONUM, f.CODBARRA
        FROM TGFFIN f
        JOIN TGFCAB cab ON cab.NUNOTA = f.NUNOTA
        LEFT JOIN TSIEMP emp ON emp.CODEMP = cab.CODEMP
        JOIN TGFPAR p ON p.CODPARC = f.CODPARC
        LEFT JOIN TGFTIT t ON t.CODTIPTIT = f.CODTIPTIT
       WHERE f.RECDESP = -1 AND NVL(f.PROVISAO,'N') = 'N'
         AND cab.TIPMOV = 'C' AND cab.CODTIPOPER IN (${TOPS_SQL}) AND cab.STATUSNOTA = 'L'
         AND TRUNC(f.DTVENC) BETWEEN TO_DATE(:di,'YYYY-MM-DD') AND TO_DATE(:df,'YYYY-MM-DD')
       ORDER BY f.DTVENC, cab.NUMNOTA, f.DESDOBRAMENTO`;
    const r = await db.simpleExecute(sql, { di, df });

    const titulos = (r.rows || []).map(x => {
      const valor = Number(x.VALOR) || 0;
      const parc = x.PARC != null ? Number(x.PARC) : 0;
      const nparc = Number(x.NPARC) || 1;
      const pago = x.BAIXA != null;
      const tipo = x.TIPO || '';
      const boleto = /BOLETO|DUPLICATA/i.test(tipo) || !!x.CODBARRA;
      return {
        codemp: x.CODEMP, empresa: x.EMPRESA || ('Empresa ' + x.CODEMP),
        numnota: x.NUMNOTA, nunota: x.NUNOTA,
        parc, nparc,
        parcLabel: parc === 0 ? 'única' : (parc + '/' + nparc),
        fornecedor: x.FORNECEDOR || '', cnpj: x.CNPJ || '',
        valor,
        emissao: x.EMISSAO, vencimento: x.VENCIMENTO, baixa: x.BAIXA,
        pago, tipo, boleto,
        nossonum: x.NOSSONUM || '', codbarra: x.CODBARRA || ''
      };
    });

    res.json({ ok: true, dt_ini: di, dt_fin: df, titulos });
  } catch (e) {
    console.error('apiDados acompanhamentoFinanceiro:', e);
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  }
}

module.exports = { paginaIndex, apiDados };
