const path = require('path');
const db = require('../config/db/oracle');

function paginaIndex(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'receitaDespesa', 'index.html'));
}

function apiContexto(req, res) {
  res.json({ ok: true, usuario: String(req.user.username || 'usuario') });
}

function dataValida(valor, padrao) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : padrao;
}

function opcao(valor, permitidos, padrao) {
  const normalizado = String(valor || '').toUpperCase();
  return permitidos.includes(normalizado) ? normalizado : padrao;
}

async function apiResumo(req, res) {
  try {
    const hoje = new Date();
    const iso = data => data.toISOString().slice(0, 10);
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const dtIni = dataValida(req.query.dt_ini, iso(primeiroDia));
    const dtFin = dataValida(req.query.dt_fin, iso(ultimoDia));
    const status = opcao(req.query.status, ['TODOS', 'ABERTO', 'BAIXADO'], 'TODOS');
    const provisao = opcao(req.query.provisao, ['TODAS', 'S', 'N'], 'TODAS');

    if (dtIni > dtFin) {
      return res.status(400).json({ ok: false, erro: 'A data inicial deve ser anterior à data final.' });
    }

    const sql = `
      SELECT f.CODEMP,
             NVL(e.NOMEFANTASIA, e.RAZAOSOCIAL) EMPRESA,
             TRUNC(f.DTVENC) DIA,
             SUM(CASE WHEN f.RECDESP = 1 THEN NVL(f.VLRDESDOB, 0) ELSE 0 END) RECEITA,
             SUM(CASE WHEN f.RECDESP = -1 THEN NVL(f.VLRDESDOB, 0) ELSE 0 END) DESPESA,
             COUNT(CASE WHEN f.RECDESP = 1 THEN 1 END) QTD_RECEITAS,
             COUNT(CASE WHEN f.RECDESP = -1 THEN 1 END) QTD_DESPESAS
        FROM TGFFIN f
        LEFT JOIN TSIEMP e ON e.CODEMP = f.CODEMP
       WHERE f.RECDESP IN (1, -1)
         AND f.CODEMP NOT IN (506, 599)
         AND TRUNC(f.DTVENC) BETWEEN TO_DATE(:dtIni, 'YYYY-MM-DD') AND TO_DATE(:dtFin, 'YYYY-MM-DD')
         AND (:status = 'TODOS'
              OR (:status = 'ABERTO' AND f.DHBAIXA IS NULL)
              OR (:status = 'BAIXADO' AND f.DHBAIXA IS NOT NULL))
         AND (:provisao = 'TODAS' OR NVL(f.PROVISAO, 'N') = :provisao)
       GROUP BY f.CODEMP, NVL(e.NOMEFANTASIA, e.RAZAOSOCIAL), TRUNC(f.DTVENC)
       ORDER BY DIA, f.CODEMP`;

    const resultado = await db.simpleExecute(sql, { dtIni, dtFin, status, provisao });
    const linhas = (resultado.rows || []).map(row => ({
      codemp: Number(row.CODEMP),
      empresa: row.EMPRESA || `Empresa ${row.CODEMP}`,
      dia: row.DIA,
      receita: Number(row.RECEITA) || 0,
      despesa: Number(row.DESPESA) || 0,
      qtdReceitas: Number(row.QTD_RECEITAS) || 0,
      qtdDespesas: Number(row.QTD_DESPESAS) || 0
    }));

    res.json({
      ok: true,
      filtros: { dt_ini: dtIni, dt_fin: dtFin, status, provisao },
      atualizadoEm: new Date().toISOString(),
      linhas
    });
  } catch (error) {
    console.error('apiResumo receitaDespesa:', error);
    res.status(500).json({ ok: false, erro: String(error.message || error) });
  }
}

module.exports = { paginaIndex, apiContexto, apiResumo };
