const path = require('path');
const db = require('../config/db/oracle');

const TOPS_VENDA = [3105, 3106, 3199];
const TOPS_DEVOLUCAO = [3202, 3200, 3204, 3201];
const CREDITO_CLIENTE = [16, 69, 93];
const movimentoMarkup = alias => `((${alias}.TIPMOV='V' AND ${alias}.CODTIPOPER IN (${TOPS_VENDA.join(',')})) OR
  (${alias}.TIPMOV='D' AND ${alias}.CODTIPOPER IN (${TOPS_DEVOLUCAO.join(',')})))`;
const tipoNegociacao = alias => `NVL((
  SELECT MAX(TPV.DESCRTIPVENDA) KEEP (DENSE_RANK LAST ORDER BY TPV.DHALTER)
    FROM TGFTPV TPV
   WHERE TPV.CODTIPVENDA = ${alias}.CODTIPVENDA
), ' ')`;
const filtroTipoNegociacao = alias => {
  const descricao = `UPPER(${tipoNegociacao(alias)})`;
  return `${descricao} NOT LIKE '%BONIF%'
    AND NOT (${descricao} LIKE '%VALE%' AND ${descricao} LIKE '%FUNCION%')`;
};
const validDate = (value, fallback) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
const numberList = value => String(value || '').split(',').map(x => x.trim()).filter(x => /^\d+$/.test(x)).map(Number);
const round = (value, decimals = 2) => Math.round((Number(value) || 0) * 10 ** decimals) / 10 ** decimals;

function inClause(values, prefix, binds) {
  return values.map((value, index) => {
    const key = `${prefix}${index}`;
    binds[key] = value;
    return `:${key}`;
  }).join(',');
}

function metrics(row) {
  const bruto = Number(row.BRUTO) || 0, liquido = Number(row.LIQUIDO) || 0;
  const desconto = Number(row.DESCONTO) || 0, custo = Number(row.CUSTO) || 0;
  const lucro = liquido - custo;
  return {
    bruto: round(bruto), liquido: round(liquido), desconto: round(desconto), custo: round(custo), lucro: round(lucro),
    descontoPct: bruto ? round(desconto / bruto * 100) : 0,
    markupPct: custo ? round(lucro / custo * 100) : null,
    margemPct: liquido ? round(lucro / liquido * 100) : null,
    notas: Number(row.NOTAS) || 0,
    itensCustoEstimado: Number(row.ITENS_CUSTO_ESTIMADO) || 0,
    itensSemCusto: Number(row.ITENS_SEM_CUSTO) || 0
  };
}

function pagina(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'markup', 'index.html'));
}

async function filtros(req, res) {
  try {
    const [empresasResult, vendedoresResult] = await Promise.all([
      db.simpleExecute(`SELECT CODEMP, NVL(NOMEFANTASIA, RAZAOSOCIAL) NOME FROM TSIEMP WHERE CODEMP IN (1,2,3,4,5,6,7) ORDER BY CODEMP`),
      db.simpleExecute(`SELECT CODVEND, NVL(APELIDO, 'Vendedor ' || CODVEND) APELIDO FROM TGFVEN WHERE NVL(ATIVO,'S')='S' ORDER BY APELIDO`)
    ]);
    res.json({ ok: true,
      empresas: empresasResult.rows.map(x => ({ codemp: Number(x.CODEMP), nome: x.NOME })),
      vendedores: vendedoresResult.rows.map(x => ({ codvend: Number(x.CODVEND), apelido: x.APELIDO }))
    });
  } catch (error) {
    console.error('markup filtros:', error);
    res.status(500).json({ ok: false, erro: String(error.message || error) });
  }
}

async function resumo(req, res) {
  try {
    const now = new Date(), iso = date => date.toISOString().slice(0, 10);
    const dtIni = validDate(req.query.dt_ini, iso(new Date(now.getFullYear(), now.getMonth(), 1)));
    const dtFin = validDate(req.query.dt_fin, iso(now));
    const empresas = numberList(req.query.emp), vendedores = numberList(req.query.vend);
    if (!empresas.length) return res.status(400).json({ ok: false, erro: 'Selecione ao menos uma empresa.' });
    const binds = { dtIni, dtFin }, empSql = inClause(empresas, 'emp', binds);
    const vendSql = vendedores.length ? inClause(vendedores, 'vend', binds) : '';
    const base = `WITH CREDITOS AS (
      SELECT NUNOTA, SUM(NVL(VLRDESDOB,0)) CREDITO
        FROM TGFFIN WHERE CODTIPTIT IN (${CREDITO_CLIENTE.join(',')}) GROUP BY NUNOTA
    ), ITENS_RAW AS (
      SELECT C.NUNOTA, C.CODEMP, TRUNC(C.DTNEG) DIA, C.TIPMOV, I.CODPROD,
             NVL(I.CODVEND,C.CODVEND) CODVEND,
             NVL(V.APELIDO,'Vendedor '||NVL(I.CODVEND,C.CODVEND)) APELIDO,
             NVL(C.VLRNOTA,0) VLRNOTA, NVL(CR.CREDITO,0) CREDITO,
             GREATEST(NVL(I.VLRTOT,0)-NVL(I.VLRDESC,0),0) VALOR_ITEM,
             SUM(GREATEST(NVL(I.VLRTOT,0)-NVL(I.VLRDESC,0),0)) OVER (PARTITION BY C.NUNOTA) TOTAL_ITENS,
             COUNT(*) OVER (PARTITION BY C.NUNOTA) QTD_ITENS,
             NVL(I.QTDNEG,0) QTDNEG, NVL(I.CUSTO,0) CUSTO_ORIGINAL
        FROM TGFCAB C JOIN TGFITE I ON I.NUNOTA=C.NUNOTA
        LEFT JOIN CREDITOS CR ON CR.NUNOTA=C.NUNOTA
        LEFT JOIN TGFVEN V ON V.CODVEND=NVL(I.CODVEND,C.CODVEND)
       WHERE C.STATUSNOTA='L' AND ${movimentoMarkup('C')}
         AND ${filtroTipoNegociacao('C')}
         AND C.CODEMP IN (${empSql})
         AND TRUNC(C.DTNEG) BETWEEN TO_DATE(:dtIni,'YYYY-MM-DD') AND TO_DATE(:dtFin,'YYYY-MM-DD')
    ), BASE_ITENS AS (
      SELECT R.*,
             CASE WHEN R.TIPMOV='D' THEN -1 ELSE 1 END SINAL,
             CASE WHEN R.TOTAL_ITENS>0 THEN R.VALOR_ITEM/R.TOTAL_ITENS ELSE 1/R.QTD_ITENS END RATEIO,
             CASE WHEN R.TIPMOV='V' THEN R.VLRNOTA ELSE 0 END
               * CASE WHEN R.TOTAL_ITENS>0 THEN R.VALOR_ITEM/R.TOTAL_ITENS ELSE 1/R.QTD_ITENS END BRUTO_ITEM,
             CASE WHEN R.TIPMOV='V' THEN GREATEST(R.VLRNOTA-R.CREDITO,0) ELSE -R.VLRNOTA END
               * CASE WHEN R.TOTAL_ITENS>0 THEN R.VALOR_ITEM/R.TOTAL_ITENS ELSE 1/R.QTD_ITENS END LIQUIDO_ITEM,
             CASE WHEN R.TIPMOV='V' THEN LEAST(R.VLRNOTA,R.CREDITO) ELSE 0 END
               * CASE WHEN R.TOTAL_ITENS>0 THEN R.VALOR_ITEM/R.TOTAL_ITENS ELSE 1/R.QTD_ITENS END DESCONTO_ITEM
        FROM ITENS_RAW R
       WHERE 1=1
         ${vendSql ? `AND R.CODVEND IN (${vendSql})` : ''}
    ), PRODUTOS_SEM_CUSTO AS (
      SELECT DISTINCT CODEMP, CODPROD FROM BASE_ITENS WHERE CUSTO_ORIGINAL=0
    ), VENDAS_HISTORICAS AS (
      SELECT C.CODEMP, I.CODPROD,
             (NVL(I.VLRTOT,0)-NVL(I.VLRDESC,0))/NULLIF(I.QTDNEG,0) PRECO_LIQ_UNIT,
             ROW_NUMBER() OVER (PARTITION BY C.CODEMP,I.CODPROD
               ORDER BY C.DTNEG DESC,C.NUNOTA DESC,I.SEQUENCIA DESC) RN
        FROM PRODUTOS_SEM_CUSTO P
        JOIN TGFCAB C ON C.CODEMP=P.CODEMP
        JOIN TGFITE I ON I.NUNOTA=C.NUNOTA AND I.CODPROD=P.CODPROD
       WHERE C.STATUSNOTA='L' AND C.TIPMOV='V' AND C.CODTIPOPER IN (${TOPS_VENDA.join(',')})
         AND ${filtroTipoNegociacao('C')}
         AND TRUNC(C.DTNEG)<=TO_DATE(:dtFin,'YYYY-MM-DD')
         AND NVL(I.QTDNEG,0)>0 AND NVL(I.VLRTOT,0)-NVL(I.VLRDESC,0)>0
    ), ULTIMA_VENDA AS (
      SELECT CODEMP,CODPROD,PRECO_LIQ_UNIT FROM VENDAS_HISTORICAS WHERE RN=1
    ), MOV AS (
      SELECT B.*,
             B.QTDNEG * CASE WHEN B.CUSTO_ORIGINAL<>0 THEN B.CUSTO_ORIGINAL
                             ELSE NVL(U.PRECO_LIQ_UNIT,0)*0.5 END CUSTO_ITEM,
             CASE WHEN B.CUSTO_ORIGINAL=0 AND U.PRECO_LIQ_UNIT IS NOT NULL THEN 1 ELSE 0 END CUSTO_ESTIMADO,
             CASE WHEN B.CUSTO_ORIGINAL=0 AND U.PRECO_LIQ_UNIT IS NULL THEN 1 ELSE 0 END SEM_CUSTO
        FROM BASE_ITENS B LEFT JOIN ULTIMA_VENDA U
          ON U.CODEMP=B.CODEMP AND U.CODPROD=B.CODPROD
    )`;
    const aggregate = fields => `SELECT ${fields}, SUM(BRUTO_ITEM) BRUTO,
      SUM(LIQUIDO_ITEM) LIQUIDO, SUM(DESCONTO_ITEM) DESCONTO,
      SUM(SINAL*CUSTO_ITEM) CUSTO, COUNT(DISTINCT NUNOTA) NOTAS,
      SUM(CASE WHEN SINAL=1 THEN CUSTO_ESTIMADO ELSE 0 END) ITENS_CUSTO_ESTIMADO,
      SUM(CASE WHEN SINAL=1 THEN SEM_CUSTO ELSE 0 END) ITENS_SEM_CUSTO FROM MOV`;
    const [totalResult, vendorsResult, dailyResult] = await Promise.all([
      db.simpleExecute(`${base} ${aggregate('1 CHAVE')}`, binds),
      db.simpleExecute(`${base} ${aggregate('CODVEND, APELIDO')} GROUP BY CODVEND, APELIDO ORDER BY LIQUIDO DESC`, binds),
      db.simpleExecute(`${base} ${aggregate("TO_CHAR(DIA,'YYYY-MM-DD') DIA")} GROUP BY DIA ORDER BY DIA`, binds)
    ]);
    res.json({ ok: true, filtros: { dt_ini: dtIni, dt_fin: dtFin, empresas, vendedores },
      formula: 'RB Markup = venda líquida − custo total; Markup % = RB Markup ÷ custo total',
      metricsSource: 'TGFITE.CUSTO × QTDNEG; na ausência, 50% do preço líquido unitário da última venda',
      total: metrics(totalResult.rows[0] || {}),
      vendedores: vendorsResult.rows.map(row => ({ codvend: Number(row.CODVEND), apelido: row.APELIDO, ...metrics(row) })),
      diario: dailyResult.rows.map(row => ({ dia: row.DIA, ...metrics(row) })), atualizadoEm: new Date().toISOString()
    });
  } catch (error) {
    console.error('markup resumo:', error);
    res.status(500).json({ ok: false, erro: String(error.message || error) });
  }
}

module.exports = { pagina, filtros, resumo };
