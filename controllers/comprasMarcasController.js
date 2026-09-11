const path = require('path');
const db = require('../config/db/oracle');

const TOPS_COMPRA_SQL = '5,6';
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
function validData(s, padrao = '2025-01-01') {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return padrao;
}
function numeros(raw) {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : String(raw).split(','))
    .map(x => String(x).trim()).filter(x => /^\d+$/.test(x)).map(Number);
}
function textos(raw) {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map(x => String(x).trim()).filter(Boolean);
}
function addIn(lista, campo, prefixo, binds) {
  if (!lista.length) return '';
  return ` AND ${campo} IN (${lista.map((valor, i) => {
    const chave = `${prefixo}${i}`; binds[chave] = valor; return `:${chave}`;
  }).join(',')})`;
}

function pagina(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'comprasMarcas', 'index.html'));
}

async function apiFiltros(req, res) {
  try {
    const r = await db.simpleExecute(`SELECT E.CODEMP,NVL(E.NOMEFANTASIA,E.RAZAOSOCIAL) NOME
      FROM TSIEMP E WHERE E.CODEMP IN (SELECT DISTINCT C.CODEMP FROM TGFCAB C
      WHERE C.TIPMOV='C' AND C.CODTIPOPER IN (${TOPS_COMPRA_SQL}) AND C.STATUSNOTA='L') ORDER BY E.CODEMP`, {});
    res.json({ empresas: (r.rows || []).map(x => ({ codemp: Number(x.CODEMP), nome: x.NOME })) });
  } catch (e) { console.error('comprasMarcas apiFiltros:', e); res.status(500).json({ erro: String(e.message || e) }); }
}

async function apiDados(req, res) {
  try {
    const emps = numeros(req.query.emp);
    if (!emps.length) return res.status(400).json({ erro: 'Selecione ao menos uma empresa.' });
    const di = validData(req.query.dt_ini), df = validData(req.query.dt_fin);
    const marcas = textos(req.query.marca), linhas = textos(req.query.linha);
    const fornecedores = numeros(req.query.fornecedor), produtos = numeros(req.query.codprod);
    const binds = { di, df }, empSql = emps.map((v, i) => { binds[`emp${i}`] = v; return `:emp${i}`; }).join(',');
    const base = `WITH ITENS_RAW AS (
      SELECT C.NUNOTA,C.CODPARC,NVL(P.NOMEPARC,'(sem fornecedor)') FORNECEDOR,
             I.CODPROD,PRO.DESCRPROD,NVL(I.QTDNEG,0) QTDNEG,
             NVL(M.DESCRICAO,NVL(PRO.MARCA,'(sem marca)')) MARCA,
             NVL(TRIM(PRO.AD_LINHA),'(sem linha)') LINHA,
             GREATEST(NVL(I.VLRTOT,0)-NVL(I.VLRDESC,0),0) VALOR_ITEM,
             SUM(GREATEST(NVL(I.VLRTOT,0)-NVL(I.VLRDESC,0),0)) OVER(PARTITION BY C.NUNOTA) TOTAL_ITENS,
             COUNT(*) OVER(PARTITION BY C.NUNOTA) QTD_LINHAS,NVL(C.VLRNOTA,0) VLR_COMPRA
        FROM TGFCAB C JOIN TGFITE I ON I.NUNOTA=C.NUNOTA
        JOIN TGFPRO PRO ON PRO.CODPROD=I.CODPROD
        LEFT JOIN TGFMAR M ON M.CODIGO=PRO.CODMARCA LEFT JOIN TGFPAR P ON P.CODPARC=C.CODPARC
       WHERE C.TIPMOV='C' AND C.CODTIPOPER IN (${TOPS_COMPRA_SQL}) AND C.STATUSNOTA='L'
         AND C.CODEMP IN (${empSql})
         AND TRUNC(C.DTNEG) BETWEEN TO_DATE(:di,'YYYY-MM-DD') AND TO_DATE(:df,'YYYY-MM-DD')
    ), MOV AS (SELECT R.*,R.VLR_COMPRA*CASE WHEN R.TOTAL_ITENS>0 THEN R.VALOR_ITEM/R.TOTAL_ITENS ELSE 1/R.QTD_LINHAS END VALOR_COMPRA FROM ITENS_RAW R)`;
    const allBinds = { ...binds };
    let filtro = 'WHERE 1=1';
    filtro += addIn(marcas, 'MARCA', 'mar', binds);
    filtro += addIn(linhas, 'LINHA', 'lin', binds);
    filtro += addIn(fornecedores, 'CODPARC', 'forn', binds);
    filtro += addIn(produtos, 'CODPROD', 'pro', binds);
    const metricas = `ROUND(SUM(VALOR_COMPRA),2) VALOR_COMPRA,SUM(QTDNEG) TOTAL_ITENS,
      COUNT(DISTINCT CODPROD) ITENS_UNICOS,COUNT(DISTINCT NUNOTA) TOTAL_COMPRAS`;
    const [detalhes, opcoes, total] = await Promise.all([
      db.simpleExecute(`${base} SELECT CODPARC,FORNECEDOR,${metricas} FROM MOV ${filtro} GROUP BY CODPARC,FORNECEDOR ORDER BY VALOR_COMPRA DESC`, binds),
      db.simpleExecute(`${base} SELECT DISTINCT MARCA,LINHA,CODPROD,DESCRPROD,CODPARC,FORNECEDOR FROM MOV ORDER BY MARCA,LINHA,DESCRPROD,FORNECEDOR`, allBinds),
      db.simpleExecute(`${base} SELECT ${metricas} FROM MOV ${filtro}`, binds)
    ]);
    const met = x => ({ valor_compra: r2(x.VALOR_COMPRA), total_itens: Number(x.TOTAL_ITENS)||0, itens_unicos: Number(x.ITENS_UNICOS)||0, total_compras: Number(x.TOTAL_COMPRAS)||0 });
    res.json({
      fornecedores: (detalhes.rows||[]).map(x => ({ codparc:Number(x.CODPARC), fornecedor:x.FORNECEDOR, ...met(x) })),
      opcoes: (opcoes.rows||[]).map(x => ({ marca:x.MARCA,linha:x.LINHA,codprod:Number(x.CODPROD),descrprod:x.DESCRPROD,codparc:Number(x.CODPARC),fornecedor:x.FORNECEDOR })),
      totais: met((total.rows&&total.rows[0])||{}), dt_ini:di, dt_fin:df, emps
    });
  } catch (e) { console.error('comprasMarcas apiDados:', e); res.status(500).json({ erro: String(e.message || e) }); }
}

module.exports = { pagina, apiFiltros, apiDados };
