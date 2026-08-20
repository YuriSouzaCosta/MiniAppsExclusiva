const path = require('path');
const db = require('../config/db/oracle');

const EMPRESAS_RELATORIO = [1, 2, 3, 4, 5, 6, 7];
const TOPS_SAIDA_FISCAL = [3101, 3104, 3106, 3199, 3200, 3202, 3204];

function paginaIndex(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'entradaSaida', 'index.html'));
}

function apiContexto(req, res) {
  res.json({ ok: true, usuario: String(req.user.username || 'usuario') });
}

function dataValida(valor, padrao) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : padrao;
}

async function apiResumo(req, res) {
  try {
    const hoje = new Date();
    const iso = data => data.toISOString().slice(0, 10);
    const dtIni = dataValida(req.query.dt_ini, iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
    const dtFin = dataValida(req.query.dt_fin, iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));

    if (dtIni > dtFin) {
      return res.status(400).json({ ok: false, erro: 'A data inicial deve ser anterior à data final.' });
    }

    const sql = `
      SELECT mov.CODEMP,
             NVL(emp.NOMEFANTASIA, emp.RAZAOSOCIAL) EMPRESA,
             mov.DIA,
             SUM(mov.ENTRADA) ENTRADA,
             SUM(mov.SAIDA) SAIDA,
             SUM(mov.QTD_ENTRADA) QTD_ENTRADA,
             SUM(mov.QTD_SAIDA) QTD_SAIDA
        FROM (
          SELECT ixn.CODEMP, TRUNC(ixn.DHEMISS) DIA,
                 SUM(NVL(ixn.VLRNOTA, 0)) ENTRADA,
                 0 SAIDA,
                 COUNT(*) QTD_ENTRADA,
                 0 QTD_SAIDA
           FROM (
                 SELECT portal.*,
                        ROW_NUMBER() OVER (
                          PARTITION BY portal.CODEMP, portal.NUMNOTA,
                                       NVL(portal.SERIEDOC, -1), NVL(portal.CNPJPARC, ' ')
                          ORDER BY portal.DHIMPORT DESC NULLS LAST, portal.NUARQUIVO DESC
                        ) RN
                   FROM TGFIXN portal
                  WHERE portal.NUMNOTA IS NOT NULL
                    AND portal.CODEMP IN (${EMPRESAS_RELATORIO.join(',')})
                    AND TRUNC(portal.DHEMISS) BETWEEN TO_DATE(:dtIni, 'YYYY-MM-DD') AND TO_DATE(:dtFin, 'YYYY-MM-DD')
                ) ixn
          WHERE ixn.RN = 1
          GROUP BY ixn.CODEMP, TRUNC(ixn.DHEMISS)

          UNION ALL

          SELECT cab.CODEMP, TRUNC(cab.DTNEG) DIA,
                 0 ENTRADA,
                 SUM(CASE WHEN cab.TIPMOV = 'V' THEN NVL(cab.VLRNOTA, 0)
                          WHEN cab.TIPMOV = 'D' THEN -NVL(cab.VLRNOTA, 0)
                          ELSE 0 END) SAIDA,
                 0 QTD_ENTRADA,
                 COUNT(DISTINCT cab.NUNOTA) QTD_SAIDA
            FROM TGFCAB cab
           WHERE cab.STATUSNOTA = 'L'
             AND cab.TIPMOV IN ('V', 'D')
             AND cab.CODTIPOPER IN (${TOPS_SAIDA_FISCAL.join(',')})
             AND cab.CODEMP IN (${EMPRESAS_RELATORIO.join(',')})
             AND TRUNC(cab.DTNEG) BETWEEN TO_DATE(:dtIni, 'YYYY-MM-DD') AND TO_DATE(:dtFin, 'YYYY-MM-DD')
           GROUP BY cab.CODEMP, TRUNC(cab.DTNEG)
        ) mov
        LEFT JOIN TSIEMP emp ON emp.CODEMP = mov.CODEMP
       GROUP BY mov.CODEMP, NVL(emp.NOMEFANTASIA, emp.RAZAOSOCIAL), mov.DIA
       ORDER BY mov.DIA, mov.CODEMP`;

    const resultado = await db.simpleExecute(sql, { dtIni, dtFin });
    const linhas = (resultado.rows || []).map(row => ({
      codemp: Number(row.CODEMP),
      empresa: row.EMPRESA || `Empresa ${row.CODEMP}`,
      dia: row.DIA,
      entrada: Number(row.ENTRADA) || 0,
      saidaSankhya: Number(row.SAIDA) || 0,
      qtdEntrada: Number(row.QTD_ENTRADA) || 0,
      qtdSaida: Number(row.QTD_SAIDA) || 0
    }));
    linhas.sort((a, b) => String(a.dia).localeCompare(String(b.dia)) || a.codemp - b.codemp);

    res.json({
      ok: true,
      filtros: { dt_ini: dtIni, dt_fin: dtFin },
      atualizadoEm: new Date().toISOString(),
      escopo: {
        fase: 'SANKHYA',
        abaPowerBi: 'Fiscal',
        combinarOrigens: false,
        empresas: EMPRESAS_RELATORIO,
        fonteEntrada: 'TGFIXN.VLRNOTA',
        criterioEntrada: 'NF-e importada no Portal de Importação de XML, por data de emissão',
        topsSaidaFiscal: TOPS_SAIDA_FISCAL
      },
      linhas
    });
  } catch (error) {
    console.error('apiResumo entradaSaida:', error);
    res.status(500).json({ ok: false, erro: String(error.message || error) });
  }
}

module.exports = { paginaIndex, apiContexto, apiResumo };
