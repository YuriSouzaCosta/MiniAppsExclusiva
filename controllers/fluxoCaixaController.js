const path = require('path');
const db = require('../config/db/oracle');
const receitaManualService = require('../services/receitaManual');

const TOPS_VENDA = [3105, 3106, 3199];
const TOPS_DEVOLUCAO = [3202, 3200, 3204, 3201];
const CREDITO_CLIENTE = [16, 69, 93];
// Produtos para venda: títulos reais, por vencimento, pendentes e baixados.
const FILTRO_PRODUTOS_REAIS = "(F.CODNAT <> 2010000 OR F.CODNAT IS NULL OR F.PROVISAO = 'N')";
const NATUREZAS_IMPOSTOS = [5090000, 5110000, 5120000];
const NATUREZAS_COMISSOES = [4010000, 4020000, 4050000];
// Compras pelo financeiro (2010000), sem somar o CMV dos itens vendidos.
const NATUREZAS_CUSTOS_VARIAVEIS = [
  2010000,
  2030000, 4030300, 3032000, 3031500, 3031600, 3040100,
  3031700, 3040400, 3050200, 3040500, 3040300, 2040000, 6050000,
  3050400, 3050100
];
const NATUREZAS_PESSOAL = [
  3010100, 3010500, 3010400, 3010200, 3010300, 3011800, 3010800,
  3010700, 5060000, 3011000, 3011300, 2050000, 3011400, 3021300,
  3021000, 3011200
];
const NATUREZAS_UTILIDADES = [3030200, 3030100, 3030600, 3030300, 3030500];
const NATUREZAS_ALUGUEL = [3020100];
const NATUREZAS_TAXAS = [3021700, 5100000, 3060600];
const NATUREZAS_MARKETING = [4030700, 3021500, 4030800];
const NATUREZAS_ADMINISTRATIVAS = [
  3020500, 3020900, 3020300, 3020400, 3030800, 2020000, 3020600, 3050900
];
const NATUREZAS_TERCEIROS = [
  3011900, 8000000, 3030900, 3031000, 3031100, 3031900, 3032200, 3032100, 6060000,
  3031300
];
const NATUREZAS_FINANCEIRAS = [3060500, 3060900, 6010000, 1020400];
const NATUREZAS_PRO_LABORE = [3012200];
const NATUREZAS_MAPEADAS_FORA_ADMINISTRATIVAS = [
  ...NATUREZAS_IMPOSTOS, ...NATUREZAS_COMISSOES, ...NATUREZAS_CUSTOS_VARIAVEIS,
  ...NATUREZAS_PESSOAL, ...NATUREZAS_UTILIDADES, ...NATUREZAS_ALUGUEL,
  ...NATUREZAS_TAXAS, ...NATUREZAS_MARKETING, ...NATUREZAS_TERCEIROS,
  ...NATUREZAS_FINANCEIRAS, ...NATUREZAS_PRO_LABORE
];
const EMPRESAS = new Set([1, 2, 3, 4, 5, 6, 7]);
const TODAS_EMPRESAS = [1, 2, 3, 4, 5, 6, 7];
const CATEGORIAS = {
  impostos: { label: 'Impostos sobre vendas', naturezas: NATUREZAS_IMPOSTOS },
  comissoes: { label: 'Comissões sobre vendas', naturezas: NATUREZAS_COMISSOES },
  custos_variaveis: { label: 'Custos Variáveis', naturezas: NATUREZAS_CUSTOS_VARIAVEIS },
  pessoal: { label: 'Gastos com Pessoal', naturezas: NATUREZAS_PESSOAL },
  utilidades: { label: 'Utilidades e Serviços', naturezas: NATUREZAS_UTILIDADES },
  aluguel: { label: 'Aluguel', naturezas: NATUREZAS_ALUGUEL },
  taxas: { label: 'Taxas e Contribuições', naturezas: NATUREZAS_TAXAS },
  marketing: { label: 'Marketing', naturezas: NATUREZAS_MARKETING },
  administrativas: { label: 'Despesas Administrativas', naturezas: NATUREZAS_ADMINISTRATIVAS, residual: true },
  terceiros: { label: 'Serviços de Terceiros', naturezas: NATUREZAS_TERCEIROS },
  financeiras: { label: 'Despesas Financeiras', naturezas: NATUREZAS_FINANCEIRAS },
  pro_labore: { label: 'Pró-labore', naturezas: NATUREZAS_PRO_LABORE }
};

function pagina(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'fluxoCaixa', 'index.html'));
}

function usuarioYuris(req) {
  return String((req.user && req.user.username) || '').trim().toUpperCase() === 'YURIS';
}

function grupoExclusivaSelecionado(empresas) {
  return TODAS_EMPRESAS.every(codigo => empresas.includes(codigo));
}

async function empresas(req, res) {
  try {
    const result = await db.simpleExecute(`SELECT E.CODEMP,
      NVL(NULLIF(TRIM(E.NOMEFANTASIA),''), E.RAZAOSOCIAL) NOME
      FROM TSIEMP E WHERE E.CODEMP IN (1,2,3,4,5,6,7) ORDER BY E.CODEMP`);
    res.json({ ok: true, podeGrupoExclusiva: usuarioYuris(req), empresas: result.rows.map(row => ({
      codigo: Number(row.CODEMP), nome: String(row.NOME || `Empresa ${row.CODEMP}`).trim()
    })) });
  } catch (error) {
    console.error('fluxoCaixa empresas:', error);
    res.status(500).json({ ok: false, erro: String(error.message || error) });
  }
}

function competenciaValida(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function empresasDaQuery(raw) {
  return [...new Set(String(raw || '').split(',').map(Number)
    .filter(codemp => Number.isInteger(codemp) && EMPRESAS.has(codemp)))];
}

function bindsEmpresas(empresas, binds) {
  return empresas.map((codemp, index) => {
    binds[`emp${index}`] = codemp;
    return `:emp${index}`;
  }).join(',');
}

async function resumo(req, res) {
  try {
    if (!competenciaValida(req.query.competencia)) {
      return res.status(400).json({ ok: false, erro: 'Competência inválida.' });
    }
    const unicas = empresasDaQuery(req.query.empresas);
    if (!unicas.length) return res.status(400).json({ ok: false, erro: 'Selecione uma empresa ou grupo.' });
    if (grupoExclusivaSelecionado(unicas) && !usuarioYuris(req)) {
      return res.status(403).json({ ok: false, erro: 'O Grupo Exclusiva é restrito ao usuário YURIS.' });
    }

    const binds = { competencia: req.query.competencia };
    const empSql = bindsEmpresas(unicas, binds);
    const descricao = `UPPER(NVL((SELECT MAX(TPV.DESCRTIPVENDA) KEEP (DENSE_RANK LAST ORDER BY TPV.DHALTER)
      FROM TGFTPV TPV WHERE TPV.CODTIPVENDA=C.CODTIPVENDA),' '))`;
    const sql = `WITH CREDITOS AS (
      SELECT NUNOTA, SUM(NVL(VLRDESDOB,0)) CREDITO
        FROM TGFFIN WHERE CODTIPTIT IN (${CREDITO_CLIENTE.join(',')}) GROUP BY NUNOTA
    ), MOV AS (
      SELECT C.NUNOTA, C.TIPMOV, NVL(C.VLRNOTA,0) VLRNOTA, NVL(CR.CREDITO,0) CREDITO
        FROM TGFCAB C LEFT JOIN CREDITOS CR ON CR.NUNOTA=C.NUNOTA
       WHERE C.STATUSNOTA='L' AND C.CODEMP IN (${empSql})
         AND TRUNC(C.DTNEG)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(C.DTNEG)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
         AND ((C.TIPMOV='V' AND C.CODTIPOPER IN (${TOPS_VENDA.join(',')}))
           OR (C.TIPMOV='D' AND C.CODTIPOPER IN (${TOPS_DEVOLUCAO.join(',')})))
         AND ${descricao} NOT LIKE '%BONIF%'
         AND NOT (${descricao} LIKE '%VALE%' AND ${descricao} LIKE '%FUNCION%')
    ), IMPOSTOS AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_IMPOSTOS.join(',')})
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), COMISSOES AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_COMISSOES.join(',')})
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), CUSTOS_VARIAVEIS AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_CUSTOS_VARIAVEIS.join(',')})
         AND ${FILTRO_PRODUTOS_REAIS}
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), PESSOAL AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_PESSOAL.join(',')})
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), UTILIDADES AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_UTILIDADES.join(',')})
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), ALUGUEL AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_ALUGUEL.join(',')})
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), TAXAS AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_TAXAS.join(',')})
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), MARKETING AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_MARKETING.join(',')})
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), ADMINISTRATIVAS AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1
         AND (F.CODNAT IN (${NATUREZAS_ADMINISTRATIVAS.join(',')})
           OR (NVL(F.CODNAT,-1) NOT IN (${NATUREZAS_MAPEADAS_FORA_ADMINISTRATIVAS.join(',')})
             AND F.CODTIPOPER IN (1,100)))
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), TERCEIROS AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_TERCEIROS.join(',')})
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), FINANCEIRAS AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_FINANCEIRAS.join(',')})
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ), PRO_LABORE AS (
      SELECT NVL(SUM(NVL(F.VLRDESDOB,0)),0) VALOR FROM TGFFIN F
       WHERE F.RECDESP=-1 AND F.CODNAT IN (${NATUREZAS_PRO_LABORE.join(',')})
         AND F.CODEMP IN (${empSql})
         AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
         AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
    ) SELECT NVL(SUM(CASE WHEN TIPMOV='V' THEN VLRNOTA ELSE 0 END),0) RECEITA_BRUTA,
             NVL(SUM(CASE WHEN TIPMOV='V' THEN GREATEST(VLRNOTA-CREDITO,0) ELSE -VLRNOTA END),0) RECEITA_LIQUIDA,
             NVL(SUM(CASE WHEN TIPMOV='V' THEN LEAST(VLRNOTA,CREDITO) ELSE 0 END),0) CREDITO_ABATIDO,
             NVL(SUM(CASE WHEN TIPMOV='D' THEN VLRNOTA ELSE 0 END),0) DEVOLUCOES,
             COUNT(DISTINCT NUNOTA) NOTAS, MAX(I.VALOR) IMPOSTOS, MAX(CO.VALOR) COMISSOES,
             MAX(CV.VALOR) CUSTOS_VARIAVEIS_NATUREZAS,
             MAX(CV.VALOR) CUSTOS_VARIAVEIS,
             MAX(PE.VALOR) PESSOAL,
             MAX(UT.VALOR) UTILIDADES, MAX(AL.VALOR) ALUGUEL,
             MAX(TX.VALOR) TAXAS, MAX(MK.VALOR) MARKETING,
             MAX(AD.VALOR) ADMINISTRATIVAS, MAX(TE.VALOR) TERCEIROS,
             MAX(FI.VALOR) FINANCEIRAS, MAX(PR.VALOR) PRO_LABORE
        FROM MOV CROSS JOIN IMPOSTOS I CROSS JOIN COMISSOES CO
        CROSS JOIN CUSTOS_VARIAVEIS CV
        CROSS JOIN PESSOAL PE CROSS JOIN UTILIDADES UT
        CROSS JOIN ALUGUEL AL CROSS JOIN TAXAS TX CROSS JOIN MARKETING MK
        CROSS JOIN ADMINISTRATIVAS AD CROSS JOIN TERCEIROS TE CROSS JOIN FINANCEIRAS FI
        CROSS JOIN PRO_LABORE PR`;
    const [result, receitaManual] = await Promise.all([
      db.simpleExecute(sql, binds),
      receitaManualService.carregar(req.query.competencia, unicas)
    ]);
    const row = result.rows[0] || {};
    const receita = receitaManual.total;
    const impostos = Number(row.IMPOSTOS) || 0;
    const comissoes = Number(row.COMISSOES) || 0;
    const receitaAposDeducoes = receita - impostos - comissoes;
    res.json({ ok: true, competencia: req.query.competencia, empresas: unicas,
      receita,
      receitaManual,
      receitaManualCompleta: receitaManual.faltantes.length === 0,
      receitaBruta: receita,
      receitaLiquida: receitaAposDeducoes,
      creditoAbatido: Number(row.CREDITO_ABATIDO) || 0,
      devolucoes: Number(row.DEVOLUCOES) || 0,
      impostos,
      comissoes,
      custosVariaveis: Number(row.CUSTOS_VARIAVEIS) || 0,
      custosVariaveisNaturezas: Number(row.CUSTOS_VARIAVEIS_NATUREZAS) || 0,
      pessoal: Number(row.PESSOAL) || 0,
      utilidades: Number(row.UTILIDADES) || 0,
      aluguel: Number(row.ALUGUEL) || 0,
      taxas: Number(row.TAXAS) || 0,
      marketing: Number(row.MARKETING) || 0,
      administrativas: Number(row.ADMINISTRATIVAS) || 0,
      terceiros: Number(row.TERCEIROS) || 0,
      financeiras: Number(row.FINANCEIRAS) || 0,
      proLabore: Number(row.PRO_LABORE) || 0,
      notas: Number(row.NOTAS) || 0, atualizadoEm: new Date().toISOString() });
  } catch (error) {
    console.error('fluxoCaixa resumo:', error);
    res.status(500).json({ ok: false, erro: String(error.message || error) });
  }
}

async function detalhes(req, res) {
  try {
    const categoria = CATEGORIAS[String(req.query.categoria || '')];
    if (!categoria) return res.status(400).json({ ok: false, erro: 'Esta linha ainda não possui naturezas configuradas.' });
    if (!competenciaValida(req.query.competencia)) return res.status(400).json({ ok: false, erro: 'Competência inválida.' });
    const empresas = empresasDaQuery(req.query.empresas);
    if (!empresas.length) return res.status(400).json({ ok: false, erro: 'Selecione uma empresa ou grupo.' });
    if (grupoExclusivaSelecionado(empresas) && !usuarioYuris(req)) {
      return res.status(403).json({ ok: false, erro: 'O Grupo Exclusiva é restrito ao usuário YURIS.' });
    }
    const binds = { competencia: req.query.competencia };
    const empSql = bindsEmpresas(empresas, binds);
    const filtroNatureza = categoria.residual
      ? `(F.CODNAT IN (${categoria.naturezas.join(',')}) OR
          (NVL(F.CODNAT,-1) NOT IN (${NATUREZAS_MAPEADAS_FORA_ADMINISTRATIVAS.join(',')})
           AND F.CODTIPOPER IN (1,100)))`
      : `F.CODNAT IN (${categoria.naturezas.join(',')})`;
    const porNatureza = req.query.agrupar === 'natureza';
    const naturezaInformada = req.query.natureza !== undefined;
    const natureza = Number(req.query.natureza);
    if (naturezaInformada && (!/^\d+$/.test(String(req.query.natureza)) || !Number.isSafeInteger(natureza))) {
      return res.status(400).json({ ok: false, erro: 'Natureza inválida.' });
    }
    if (naturezaInformada) binds.natureza = natureza;
    const parceiroInformado = req.query.parceiro !== undefined;
    const parceiro = Number(req.query.parceiro);
    if (parceiroInformado && (!/^\d+$/.test(String(req.query.parceiro)) || !Number.isSafeInteger(parceiro))) {
      return res.status(400).json({ ok: false, erro: 'Parceiro inválido.' });
    }
    if (parceiroInformado) binds.parceiro = parceiro;
    const filtroSelecionado = (naturezaInformada ? ' AND F.CODNAT=:natureza' : '') +
      (parceiroInformado ? ' AND F.CODPARC=:parceiro' : '');
    const sql = porNatureza ? `SELECT F.CODNAT,
      NVL(N.DESCRNAT,'Natureza '||F.CODNAT) NATUREZA,
      SUM(NVL(F.VLRDESDOB,0)) VALOR, COUNT(*) TITULOS
      FROM TGFFIN F LEFT JOIN TGFNAT N ON N.CODNAT=F.CODNAT
     WHERE F.RECDESP=-1 AND ${filtroNatureza}${filtroSelecionado}
       AND ${FILTRO_PRODUTOS_REAIS}
       AND F.CODEMP IN (${empSql})
       AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
       AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
     GROUP BY F.CODNAT, NVL(N.DESCRNAT,'Natureza '||F.CODNAT)
     ORDER BY VALOR DESC` : `SELECT F.CODPARC,
      NVL(P.NOMEPARC,'Parceiro '||F.CODPARC) PARCEIRO,
      SUM(NVL(F.VLRDESDOB,0)) VALOR, COUNT(*) TITULOS
      FROM TGFFIN F LEFT JOIN TGFPAR P ON P.CODPARC=F.CODPARC
     WHERE F.RECDESP=-1 AND ${filtroNatureza}${filtroSelecionado}
       AND ${FILTRO_PRODUTOS_REAIS}
       AND F.CODEMP IN (${empSql})
       AND TRUNC(F.DTVENC)>=TO_DATE(:competencia||'-01','YYYY-MM-DD')
       AND TRUNC(F.DTVENC)<ADD_MONTHS(TO_DATE(:competencia||'-01','YYYY-MM-DD'),1)
     GROUP BY F.CODPARC, NVL(P.NOMEPARC,'Parceiro '||F.CODPARC)
     ORDER BY VALOR DESC`;
    const result = await db.simpleExecute(sql, binds);
    if (porNatureza) {
      const naturezas = result.rows.map(row => ({ codnat: Number(row.CODNAT), natureza: row.NATUREZA,
        valor: Number(row.VALOR) || 0, titulos: Number(row.TITULOS) || 0 }));
      return res.json({ ok: true, categoria: req.query.categoria, label: categoria.label, empresas,
        competencia: req.query.competencia, total: naturezas.reduce((sum, item) => sum + item.valor, 0), naturezas });
    }
    const parceiros = result.rows.map(row => ({ codparc: Number(row.CODPARC), parceiro: row.PARCEIRO,
      valor: Number(row.VALOR) || 0, titulos: Number(row.TITULOS) || 0 }));
    res.json({ ok: true, categoria: req.query.categoria, label: categoria.label, empresas,
      competencia: req.query.competencia, total: parceiros.reduce((sum, item) => sum + item.valor, 0), parceiros });
  } catch (error) {
    console.error('fluxoCaixa detalhes:', error);
    res.status(500).json({ ok: false, erro: String(error.message || error) });
  }
}

module.exports = { pagina, empresas, resumo, detalhes };
