// controllers/faturamentoController.js
// Dashboard de Faturamento por Vendedor (ao vivo) + Painel TV/mobile.
// Reusa o pool Oracle do projeto (config/db/oracle) e o login (ensureAuth na rota).
// Definicao de faturamento identica a DRE: TOPs abaixo, TIPMOV V/D, STATUSNOTA='L',
// devolucoes (D) entram negativas. NUNCA faz JOIN com TGFTOP (fan-out por DHALTER).
const path = require('path');
const fs = require('fs');
const db = require('../config/db/oracle');

const FAT_TOPS = [3101, 3104, 3105, 3106, 3199, 3200, 3202, 3204];
const TOPS_SQL = FAT_TOPS.join(',');
// Tipos de titulo pagos com credito de devolucao/troca (TGFTIT) que NAO contam como
// faturamento. Nas trocas conta so a parte paga. 16=CREDITO CLIENTE[D], 69=DEVOLUCOES, 93=[C].
const CREDCLI_SQL = [16, 69, 93].join(',');
const WATCH_MS = (parseInt(process.env.FAT_WATCH_SEG || '5', 10) || 5) * 1000;

// -------------------- helpers --------------------
function validData(s, padrao = '2025-01-01') {
  if (typeof s === 'string') {
    const p = s.split('-');
    if (p.length === 3 && p.every(x => /^\d+$/.test(x))) return s;
  }
  return padrao;
}
function parseEmps(raw) {
  if (!raw) return [];
  return String(raw).split(',').map(x => x.trim()).filter(x => /^\d+$/.test(x)).map(Number);
}
function anoAnterior(d) {
  let [y, m, dd] = d.split('-');
  y = String(parseInt(y, 10) - 1);
  if (m === '02' && dd === '29') dd = '28';
  return `${y}-${m}-${dd}`;
}
function empClause(emps, binds) {
  return emps.map((e, i) => { const k = 'e' + i; binds[k] = e; return ':' + k; }).join(',');
}
function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

// -------------------- consultas --------------------
async function qFaturamento(emps, di, df) {
  const binds = { di, df };
  const empIn = empClause(emps, binds);
  // Rateio de vendas divididas: VLRNOTA distribuido entre os vendedores dos ITENS
  // (TGFITE.CODVEND), proporcional ao valor liquido do item. Preserva SUM(VLRNOTA).
  const sql = `
    SELECT G.VEND CODVEND,
           NVL(VEN.APELIDO,'(sem vendedor)') APELIDO,
           ROUND(G.BRUTO,2) BRUTO, ROUND(G.DEVOL,2) DEVOL, G.QTD_V, G.QTD_D
      FROM (
        SELECT VEND,
               SUM(CASE WHEN TIPMOV='V' THEN FAT ELSE 0 END) BRUTO,
               SUM(CASE WHEN TIPMOV='D' THEN FAT ELSE 0 END) DEVOL,
               COUNT(DISTINCT CASE WHEN TIPMOV='V' THEN NUNOTA END) QTD_V,
               COUNT(DISTINCT CASE WHEN TIPMOV='D' THEN NUNOTA END) QTD_D
          FROM (
            SELECT CAB.NUNOTA, CAB.TIPMOV,
                   COALESCE(CCM.CODVEND, CAB.CODVEND) VEND,
                   (CASE WHEN CAB.TIPMOV='V' THEN NVL(CAB.VLRNOTA,0)-NVL(CC.CREDCLI,0) ELSE NVL(CAB.VLRNOTA,0) END)
                   * (CASE WHEN CCM.NUNOTA IS NULL THEN 1
                           ELSE CCM.PERCCOM / NULLIF(SUM(CCM.PERCCOM) OVER (PARTITION BY CAB.NUNOTA),0) END) FAT
              FROM TGFCAB CAB
              LEFT JOIN TGFCCM CCM ON CCM.NUNOTA = CAB.NUNOTA
              LEFT JOIN (SELECT NUNOTA, SUM(NVL(VLRDESDOB,0)) CREDCLI FROM TGFFIN
                          WHERE CODTIPTIT IN (${CREDCLI_SQL}) GROUP BY NUNOTA) CC ON CC.NUNOTA = CAB.NUNOTA
             WHERE CAB.CODTIPOPER IN (${TOPS_SQL})
               AND CAB.TIPMOV IN ('V','D')
               AND CAB.STATUSNOTA='L'
               AND CAB.CODEMP IN (${empIn})
               AND TRUNC(CAB.DTNEG) BETWEEN TO_DATE(:di,'YYYY-MM-DD') AND TO_DATE(:df,'YYYY-MM-DD')
          ) GROUP BY VEND
      ) G
      LEFT JOIN TGFVEN VEN ON VEN.CODVEND = G.VEND
     ORDER BY BRUTO DESC`;
  const result = await db.simpleExecute(sql, binds);
  return (result.rows || []).map(row => {
    const bruto = Number(row.BRUTO) || 0, devol = Number(row.DEVOL) || 0;
    return {
      codvend: row.CODVEND != null ? Number(row.CODVEND) : null,
      apelido: row.APELIDO,
      bruto: r2(bruto), devol: r2(devol), liquido: r2(bruto - devol),
      qtd_v: Number(row.QTD_V) || 0, qtd_d: Number(row.QTD_D) || 0
    };
  });
}
function totais(linhas) {
  const b = linhas.reduce((s, d) => s + d.bruto, 0), dv = linhas.reduce((s, d) => s + d.devol, 0);
  return {
    bruto: r2(b), devol: r2(dv), liquido: r2(b - dv),
    qtd_v: linhas.reduce((s, d) => s + d.qtd_v, 0),
    qtd_d: linhas.reduce((s, d) => s + d.qtd_d, 0), vendedores: linhas.length
  };
}
async function sentinela(emps, di, df) {
  const binds = { di, df };
  const empIn = empClause(emps, binds);
  const sql = `
    SELECT COUNT(*) N, NVL(SUM(NVL(VLRNOTA,0)),0) S, NVL(MAX(NUNOTA),0) M
      FROM TGFCAB
     WHERE CODTIPOPER IN (${TOPS_SQL}) AND TIPMOV IN ('V','D') AND STATUSNOTA='L'
       AND CODEMP IN (${empIn})
       AND TRUNC(DTNEG) BETWEEN TO_DATE(:di,'YYYY-MM-DD') AND TO_DATE(:df,'YYYY-MM-DD')`;
  const r = await db.simpleExecute(sql, binds);
  const row = (r.rows && r.rows[0]) || { N: 0, S: 0, M: 0 };
  return { N: Number(row.N) || 0, S: r2(row.S), M: Number(row.M) || 0 };
}

// -------------------- paginas --------------------
function paginaIndex(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'faturamento', 'index.html'));
}
function paginaPainel(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'faturamento', 'painel.html'));
}

// -------------------- API --------------------
async function apiFiltros(req, res) {
  try {
    const sql = `
      SELECT E.CODEMP, NVL(E.NOMEFANTASIA, E.RAZAOSOCIAL) NOME
        FROM TSIEMP E
       WHERE E.CODEMP IN (
               SELECT DISTINCT CODEMP FROM TGFCAB
                WHERE CODTIPOPER IN (${TOPS_SQL}) AND TIPMOV IN ('V','D')
                  AND STATUSNOTA='L' AND DTNEG >= TO_DATE('2025-01-01','YYYY-MM-DD'))
       ORDER BY E.CODEMP`;
    const r = await db.simpleExecute(sql, {});
    const empresas = (r.rows || []).map(x => ({
      codemp: Number(x.CODEMP), nome: (x.NOME || ('Empresa ' + x.CODEMP)).trim()
    }));
    res.json({ empresas });
  } catch (e) {
    console.error('faturamento apiFiltros:', e);
    res.status(500).json({ erro: String(e.message || e) });
  }
}
async function apiDados(req, res) {
  try {
    const emps = parseEmps(req.query.emp);
    if (!emps.length) return res.status(400).json({ erro: 'Selecione ao menos uma empresa.' });
    const di = validData(req.query.dt_ini), df = validData(req.query.dt_fin);
    const linhas = await qFaturamento(emps, di, df);
    res.json({ linhas, dt_ini: di, dt_fin: df, emps });
  } catch (e) {
    console.error('faturamento apiDados:', e);
    res.status(500).json({ erro: String(e.message || e) });
  }
}
async function apiPainel(req, res) {
  try {
    const emps = parseEmps(req.query.emp);
    if (!emps.length) return res.status(400).json({ erro: 'Selecione ao menos uma empresa.' });
    const di = validData(req.query.dt_ini), df = validData(req.query.dt_fin);
    const la = await qFaturamento(emps, di, df);
    const pi = anoAnterior(di), pf = anoAnterior(df);
    const lp = await qFaturamento(emps, pi, pf);
    res.json({
      atual: { tot: totais(la), linhas: la, dt_ini: di, dt_fin: df },
      anterior: { tot: totais(lp), linhas: lp, dt_ini: pi, dt_fin: pf }
    });
  } catch (e) {
    console.error('faturamento apiPainel:', e);
    res.status(500).json({ erro: String(e.message || e) });
  }
}
// SSE: sentinela leve a cada WATCH_MS; push 'change' so quando o faturamento muda.
// Pool-friendly: cada tick abre/fecha uma conexao do pool via simpleExecute (nao segura conexao).
async function apiStream(req, res) {
  const emps = parseEmps(req.query.emp);
  if (!emps.length) { res.status(400).json({ erro: 'Selecione ao menos uma empresa.' }); return; }
  const di = validData(req.query.dt_ini), df = validData(req.query.dt_fin);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (res.flushHeaders) res.flushHeaders();
  let last = null, alive = true;
  async function tick() {
    if (!alive) return;
    try {
      const sig = await sentinela(emps, di, df);
      const key = `${sig.N}|${sig.S}|${sig.M}`;
      if (last === null) {
        last = key;
        res.write(`event: init\ndata: ${JSON.stringify({ notas: sig.N, total: sig.S })}\n\n`);
      } else if (key !== last) {
        last = key;
        res.write(`event: change\ndata: ${JSON.stringify({ notas: sig.N, total: sig.S })}\n\n`);
      } else {
        res.write(': ping\n\n');
      }
    } catch (e) { /* erro transiente de rede/pool: ignora ate o proximo tick */ }
  }
  await tick();
  const iv = setInterval(tick, WATCH_MS);
  req.on('close', () => { alive = false; clearInterval(iv); });
}

// ==================== Heatmap (dia-da-semana x hora) ====================
async function qHeatmap(emps, di, df) {
  const binds = { di, df };
  const empIn = empClause(emps, binds);
  const sql = `
    SELECT (TRUNC(CAB.DTNEG) - TRUNC(CAB.DTNEG,'IW')) DOW,
           TO_NUMBER(TO_CHAR(NVL(CAB.DTFATUR,CAB.DTALTER),'HH24')) HR,
           COUNT(*) QT, ROUND(SUM(NVL(CAB.VLRNOTA,0)),2) VAL
      FROM TGFCAB CAB
     WHERE CAB.CODTIPOPER IN (${TOPS_SQL}) AND CAB.TIPMOV='V' AND CAB.STATUSNOTA='L'
       AND CAB.CODEMP IN (${empIn})
       AND TRUNC(CAB.DTNEG) BETWEEN TO_DATE(:di,'YYYY-MM-DD') AND TO_DATE(:df,'YYYY-MM-DD')
       AND NVL(CAB.DTFATUR,CAB.DTALTER) IS NOT NULL
     GROUP BY (TRUNC(CAB.DTNEG) - TRUNC(CAB.DTNEG,'IW')),
              TO_NUMBER(TO_CHAR(NVL(CAB.DTFATUR,CAB.DTALTER),'HH24'))`;
  const r = await db.simpleExecute(sql, binds);
  return (r.rows || []).map(x => ({ dow: Number(x.DOW), hr: Number(x.HR), qt: Number(x.QT) || 0, val: r2(x.VAL) }));
}

// ==================== Vendedor (totais + serie diaria) ====================
async function qVendedorSerie(cod, emps, di, df) {
  const binds = { cv: cod, di, df };
  const empIn = empClause(emps, binds);
  // serie diaria COM rateio de vendas divididas; filtra pelo vendedor EFETIVO do item.
  const sql = `
    SELECT DIA,
           ROUND(SUM(CASE WHEN TIPMOV='V' THEN FAT ELSE -FAT END),2) LIQ,
           COUNT(DISTINCT CASE WHEN TIPMOV='V' THEN NUNOTA END) QTD
      FROM (
        SELECT TO_CHAR(CAB.DTNEG,'YYYY-MM-DD') DIA, CAB.TIPMOV, CAB.NUNOTA,
               COALESCE(CCM.CODVEND, CAB.CODVEND) VEND,
               (CASE WHEN CAB.TIPMOV='V' THEN NVL(CAB.VLRNOTA,0)-NVL(CC.CREDCLI,0) ELSE NVL(CAB.VLRNOTA,0) END)
               * (CASE WHEN CCM.NUNOTA IS NULL THEN 1
                       ELSE CCM.PERCCOM / NULLIF(SUM(CCM.PERCCOM) OVER (PARTITION BY CAB.NUNOTA),0) END) FAT
          FROM TGFCAB CAB
          LEFT JOIN TGFCCM CCM ON CCM.NUNOTA = CAB.NUNOTA
          LEFT JOIN (SELECT NUNOTA, SUM(NVL(VLRDESDOB,0)) CREDCLI FROM TGFFIN
                      WHERE CODTIPTIT IN (${CREDCLI_SQL}) GROUP BY NUNOTA) CC ON CC.NUNOTA = CAB.NUNOTA
         WHERE CAB.CODTIPOPER IN (${TOPS_SQL}) AND CAB.TIPMOV IN ('V','D') AND CAB.STATUSNOTA='L'
           AND CAB.CODEMP IN (${empIn})
           AND TRUNC(CAB.DTNEG) BETWEEN TO_DATE(:di,'YYYY-MM-DD') AND TO_DATE(:df,'YYYY-MM-DD')
      )
     WHERE VEND = :cv
     GROUP BY DIA ORDER BY DIA`;
  const r = await db.simpleExecute(sql, binds);
  return (r.rows || []).map(x => ({ dia: x.DIA, liq: r2(x.LIQ), qtd: Number(x.QTD) || 0 }));
}
function totSerie(s) { return { liquido: r2(s.reduce((a, d) => a + d.liq, 0)), qtd_v: s.reduce((a, d) => a + d.qtd, 0) }; }

async function qVendedor(cod, emps, di, df) {
  const rn = await db.simpleExecute(`SELECT NVL(APELIDO,'(sem)') A FROM TGFVEN WHERE CODVEND=:c`, { c: cod });
  const apelido = (rn.rows && rn.rows[0]) ? rn.rows[0].A : ('Vendedor ' + cod);
  const serie = await qVendedorSerie(cod, emps, di, df);
  const pi = anoAnterior(di), pf = anoAnterior(df);
  const serieAnt = await qVendedorSerie(cod, emps, pi, pf);
  return {
    codvend: cod, apelido,
    atual: { tot: totSerie(serie), serie, dt_ini: di, dt_fin: df },
    anterior: { tot: totSerie(serieAnt), serie: serieAnt, dt_ini: pi, dt_fin: pf }
  };
}

// ==================== Metas (JSON em data/metas.json) ====================
function metasPath() { return process.env.METAS_FILE || path.join(__dirname, '..', 'data', 'metas.json'); }
function metasLoad() {
  try { return JSON.parse(fs.readFileSync(metasPath(), 'utf-8')) || {}; } catch (e) { return {}; }
}
function metaSaveOne(comp, cod, valor) {
  const data = metasLoad(); comp = String(comp);
  if (!data[comp]) data[comp] = {};
  if (valor === null || valor === undefined || valor === '' || Number(valor) === 0) {
    delete data[comp][String(cod)];
  } else {
    data[comp][String(cod)] = r2(valor);
  }
  const p = metasPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

// ==================== handlers ====================
function paginaVendedor(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'faturamento', 'vendedor.html'));
}
async function apiHeatmap(req, res) {
  try {
    const emps = parseEmps(req.query.emp);
    if (!emps.length) return res.status(400).json({ erro: 'Selecione ao menos uma empresa.' });
    const di = validData(req.query.dt_ini), df = validData(req.query.dt_fin);
    res.json({ cells: await qHeatmap(emps, di, df) });
  } catch (e) { console.error('faturamento apiHeatmap:', e); res.status(500).json({ erro: String(e.message || e) }); }
}
async function apiVendedor(req, res) {
  try {
    const cod = String(req.query.cod || '');
    if (!/^-?\d+$/.test(cod)) return res.status(400).json({ erro: 'vendedor invalido' });
    const emps = parseEmps(req.query.emp);
    if (!emps.length) return res.status(400).json({ erro: 'Selecione ao menos uma empresa.' });
    const di = validData(req.query.dt_ini), df = validData(req.query.dt_fin);
    res.json(await qVendedor(Number(cod), emps, di, df));
  } catch (e) { console.error('faturamento apiVendedor:', e); res.status(500).json({ erro: String(e.message || e) }); }
}
function apiMetas(req, res) {
  try { res.json(metasLoad()); } catch (e) { res.status(500).json({ erro: String(e.message || e) }); }
}
function apiMetaSet(req, res) {
  try {
    const b = req.body || {};
    if (b.cod === undefined || b.cod === null || !b.comp) return res.status(400).json({ erro: 'cod e comp obrigatorios' });
    metaSaveOne(b.comp, b.cod, b.valor);
    res.json({ ok: true });
  } catch (e) { console.error('faturamento apiMetaSet:', e); res.status(500).json({ erro: String(e.message || e) }); }
}

module.exports = {
  paginaIndex, paginaPainel, paginaVendedor,
  apiFiltros, apiDados, apiPainel, apiStream,
  apiHeatmap, apiVendedor, apiMetas, apiMetaSet
};
