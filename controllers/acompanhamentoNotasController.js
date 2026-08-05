// controllers/acompanhamentoNotasController.js
// Acompanhamento de Notas de ENTRADA: do Portal de Importacao (TGFIXN) ate o
// lancamento (TGFCAB, TOP 5/6 confirmada). Cruza por Numero da Nota + CNPJ do
// fornecedor + Empresa. "Chegada" e um carimbo MANUAL (botao) guardado na tabela
// custom AD_NOTA_CHEGADA; o prazo = DTMOV (lancamento) - DHCHEGADA (chegada).
// 100% do banco (Sankhya/Oracle). Segue o padrao do modulo faturamento.
const path = require('path');
const db = require('../config/db/oracle');

const TOP_ENTRADA = [5, 6];              // TOPs de entrada
const TOPS_SQL = TOP_ENTRADA.join(',');
const PRAZO_CHEGADA = parseInt(process.env.PRAZO_CHEGADA_DIAS, 10) || 10; // dias emissao->chegada

function paginaIndex(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'acompanhamentoNotas', 'index.html'));
}

// Lista as notas importadas no Portal e cruza com o lancamento + carimbo de chegada.
async function apiDados(req, res) {
  try {
    const dias = Math.min(parseInt(req.query.dias, 10) || 60, 365);
    const sql = `
      SELECT ixn.NUARQUIVO, ixn.CODEMP,
             NVL(emp.NOMEFANTASIA, emp.RAZAOSOCIAL) EMPRESA,
             ixn.NUMNOTA, ixn.SERIEDOC, ixn.CNPJPARC, ixn.XNOMEEMIT FORNECEDOR,
             NVL(ixn.VLRNOTA,0) VLRNOTA, ixn.DHIMPORT, ixn.DHEMISS,
             lanc.NUNOTA, lanc.DTMOV, ch.DHCHEGADA,
             (SELECT SUM(f.VLRDESDOB) FROM TGFFIN f
                JOIN TGFPAR p ON p.CODPARC = f.CODPARC
                 AND REGEXP_REPLACE(p.CGC_CPF,'[^0-9]','') = ixn.CNPJPARC
               WHERE f.NUMNOTA = ixn.NUMNOTA AND f.RECDESP = -1) FIN_SOMA
        FROM TGFIXN ixn
        LEFT JOIN TSIEMP emp ON emp.CODEMP = ixn.CODEMP
        LEFT JOIN (
              SELECT cab.NUMNOTA, cab.CODEMP,
                     REGEXP_REPLACE(par.CGC_CPF,'[^0-9]','') CNPJ,
                     MIN(cab.NUNOTA) NUNOTA, MIN(cab.DTMOV) DTMOV
                FROM TGFCAB cab
                JOIN TGFPAR par ON par.CODPARC = cab.CODPARC
               WHERE cab.CODTIPOPER IN (${TOPS_SQL})
                 AND cab.TIPMOV = 'C' AND cab.STATUSNOTA = 'L'
               GROUP BY cab.NUMNOTA, cab.CODEMP, REGEXP_REPLACE(par.CGC_CPF,'[^0-9]','')
             ) lanc
          ON lanc.NUMNOTA = ixn.NUMNOTA
         AND lanc.CODEMP  = ixn.CODEMP
         AND lanc.CNPJ    = ixn.CNPJPARC
        LEFT JOIN AD_NOTA_CHEGADA ch
          ON ch.NUMNOTA = ixn.NUMNOTA
         AND ch.CODEMP  = ixn.CODEMP
         AND ch.CNPJ    = ixn.CNPJPARC
       WHERE ixn.DHEMISS >= TRUNC(SYSDATE) - :dias
         AND ixn.NUMNOTA IS NOT NULL
       ORDER BY ixn.DHEMISS DESC`;
    const r = await db.simpleExecute(sql, { dias });

    const notas = (r.rows || []).map(x => {
      const lancadaCab = x.NUNOTA != null;
      const valor = Number(x.VLRNOTA) || 0;
      const finSoma = x.FIN_SOMA != null ? Number(x.FIN_SOMA) : null;      // soma dos titulos TGFFIN
      const chegouFin = finSoma != null && Math.abs(finSoma - valor) <= 0.05; // financeiro bate a nota
      const lancada = lancadaCab || chegouFin; // Versão completa: financeiro conta como Lançada
      const chegada = x.DHCHEGADA ? new Date(x.DHCHEGADA) : null;
      const chegouManual = !!x.DHCHEGADA;
      const chegou = lancada || chegouManual || chegouFin;
      const dtmov = x.DTMOV ? new Date(x.DTMOV) : null;
      const emissao = x.DHEMISS ? new Date(x.DHEMISS) : null;
      let prazoDias = null;
      if (chegada && dtmov) prazoDias = Math.round((dtmov - chegada) / 86400000 * 10) / 10;
      let diasEmissao = null;
      if (emissao) diasEmissao = Math.floor((Date.now() - emissao.getTime()) / 86400000);
      // urgente: passou do prazo desde a emissao E ainda NAO chegou (nem lancada/financeiro/manual)
      const urgente = !!(emissao && diasEmissao > PRAZO_CHEGADA && !chegou);
      return {
        nuarq: x.NUARQUIVO,
        codemp: x.CODEMP, empresa: x.EMPRESA || ('Empresa ' + x.CODEMP),
        numnota: x.NUMNOTA, serie: x.SERIEDOC, cnpj: x.CNPJPARC,
        fornecedor: x.FORNECEDOR || '', valor,
        emissao: x.DHEMISS, diasEmissao,
        dhimport: x.DHIMPORT, nunota: x.NUNOTA, dtmov: x.DTMOV,
        chegada: x.DHCHEGADA, chegouManual, chegouFin, chegou,
        lancada, lancadaCab, prazoDias, urgente,
        status: lancada ? 'lancada' : 'fila'
      };
    });

    const comPrazo = notas.filter(n => n.prazoDias != null);
    const urgentesArr = notas.filter(n => n.urgente);
    const cards = {
      total: notas.length,
      fila: notas.filter(n => !n.lancada).length,
      lancada: notas.filter(n => n.lancada).length,
      chegada: notas.filter(n => n.chegou).length,
      chegouFin: notas.filter(n => n.chegouFin && !n.lancadaCab).length,
      urgentes: urgentesArr.length,
      valor: notas.reduce((s, n) => s + n.valor, 0),
      valorFila: notas.filter(n => !n.lancada).reduce((s, n) => s + n.valor, 0),
      valorUrgente: urgentesArr.reduce((s, n) => s + n.valor, 0),
      prazoMedio: comPrazo.length
        ? Math.round(comPrazo.reduce((s, n) => s + n.prazoDias, 0) / comPrazo.length * 10) / 10
        : null
    };
    // urgentes primeiro; depois as mais antigas por emissao
    notas.sort((a, b) => (Number(b.urgente) - Number(a.urgente))
                        || ((b.diasEmissao || 0) - (a.diasEmissao || 0)));
    res.json({ ok: true, dias, prazo: PRAZO_CHEGADA, cards, notas });
  } catch (e) {
    console.error('apiDados acompanhamento:', e);
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  }
}

// Carimba (ou remove) a chegada MANUAL de uma nota. Chave: numnota + cnpj + empresa.
async function marcarChegada(req, res) {
  try {
    const numnota = parseInt(req.body.numnota, 10);
    const cnpj = String(req.body.cnpj || '').replace(/\D/g, '');
    const codemp = parseInt(req.body.codemp, 10);
    if (!numnota || !cnpj || !codemp) {
      return res.status(400).json({ ok: false, erro: 'numnota/cnpj/codemp obrigatorios' });
    }
    const remover = req.body.remover === true || req.body.remover === 'true';
    if (remover) {
      await db.simpleExecute(
        `DELETE FROM AD_NOTA_CHEGADA WHERE NUMNOTA=:n AND CNPJ=:c AND CODEMP=:e`,
        { n: numnota, c: cnpj, e: codemp }, { autoCommit: true });
      return res.json({ ok: true, chegada: null });
    }
    const nomeusu = (req.user && (req.user.nomeusu || req.user.NOMEUSU)) || null;
    await db.simpleExecute(
      `MERGE INTO AD_NOTA_CHEGADA t
         USING (SELECT :n NUMNOTA, :c CNPJ, :e CODEMP FROM DUAL) s
            ON (t.NUMNOTA = s.NUMNOTA AND t.CNPJ = s.CNPJ AND t.CODEMP = s.CODEMP)
       WHEN MATCHED THEN
            UPDATE SET DHCHEGADA = SYSDATE,
                       CODUSU = (SELECT MIN(CODUSU) FROM TSIUSU WHERE UPPER(NOMEUSU)=UPPER(:u))
       WHEN NOT MATCHED THEN
            INSERT (NUMNOTA, CNPJ, CODEMP, DHCHEGADA, CODUSU)
            VALUES (s.NUMNOTA, s.CNPJ, s.CODEMP, SYSDATE,
                   (SELECT MIN(CODUSU) FROM TSIUSU WHERE UPPER(NOMEUSU)=UPPER(:u)))`,
      { n: numnota, c: cnpj, e: codemp, u: nomeusu }, { autoCommit: true });
    res.json({ ok: true });
  } catch (e) {
    console.error('marcarChegada:', e);
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  }
}

// Itens da nota, lidos DIRETO do XML guardado na TGFIXN (Oracle parseia via XMLTABLE).
// Funciona pra nota na fila ou lancada. Identifica pela PK NUARQUIVO.
async function apiItens(req, res) {
  try {
    const nuarq = parseInt(req.query.nuarq, 10);
    if (!nuarq) return res.status(400).json({ ok: false, erro: 'nuarq obrigatorio' });
    const cabRes = await db.simpleExecute(
      `SELECT NUMNOTA, SERIEDOC, XNOMEEMIT, CNPJPARC, CODEMP, VLRNOTA, DHEMISS, TIPO,
              XNOMETRANSP, CNPJTRANSP
         FROM TGFIXN WHERE NUARQUIVO = :n`, { n: nuarq });
    const cab = (cabRes.rows && cabRes.rows[0]) || {};
    // XPath por local-name() = ignora o namespace. Necessario porque notas subidas
    // pelo Portal do Sankhya ficam sem o namespace padrao da NFe, e as inseridas
    // direto mantem o namespace -> local-name() casa os dois casos.
    const itRes = await db.simpleExecute(`
      SELECT x.item, x.xprod, x.ucom, x.qcom, x.vuncom, x.vprod
        FROM TGFIXN ixn,
             XMLTABLE('//*[local-name()="det"]' PASSING XMLTYPE(ixn.XML)
                      COLUMNS item   VARCHAR2(6)   PATH '@nItem',
                              xprod  VARCHAR2(240) PATH '*[local-name()="prod"]/*[local-name()="xProd"]',
                              ucom   VARCHAR2(12)  PATH '*[local-name()="prod"]/*[local-name()="uCom"]',
                              qcom   VARCHAR2(30)  PATH '*[local-name()="prod"]/*[local-name()="qCom"]',
                              vuncom VARCHAR2(30)  PATH '*[local-name()="prod"]/*[local-name()="vUnCom"]',
                              vprod  VARCHAR2(30)  PATH '*[local-name()="prod"]/*[local-name()="vProd"]') x
       WHERE ixn.NUARQUIVO = :n
       ORDER BY TO_NUMBER(x.item)`, { n: nuarq });
    const num = v => Number(String(v == null ? '0' : v).replace(',', '.')) || 0;
    const itens = (itRes.rows || []).map(r => ({
      item: r.ITEM, descricao: r.XPROD, un: r.UCOM,
      qtd: num(r.QCOM), vunit: num(r.VUNCOM), vtotal: num(r.VPROD)
    }));
    res.json({
      ok: true,
      cab: {
        numnota: cab.NUMNOTA, serie: cab.SERIEDOC, fornecedor: cab.XNOMEEMIT,
        cnpj: cab.CNPJPARC, codemp: cab.CODEMP, valor: Number(cab.VLRNOTA) || 0,
        emissao: cab.DHEMISS, tipo: cab.TIPO,
        transportadora: cab.XNOMETRANSP, cnpjTransp: cab.CNPJTRANSP
      },
      itens, qtdItens: itens.length,
      somaItens: itens.reduce((s, i) => s + i.vtotal, 0)
    });
  } catch (e) {
    console.error('apiItens:', e);
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  }
}

function paginaIndexLite(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'acompanhamentoNotas', 'indexLite.html'));
}

async function apiDadosLite(req, res) {
  try {
    const dias = Math.min(parseInt(req.query.dias, 10) || 60, 365);
    const sql = `
      SELECT ixn.NUARQUIVO, ixn.CODEMP,
             NVL(emp.NOMEFANTASIA, emp.RAZAOSOCIAL) EMPRESA,
             ixn.NUMNOTA, ixn.SERIEDOC, ixn.CNPJPARC, ixn.XNOMEEMIT FORNECEDOR,
             NVL(ixn.VLRNOTA,0) VLRNOTA, ixn.DHIMPORT, ixn.DHEMISS,
             lanc.NUNOTA, lanc.DTMOV, ch.DHCHEGADA,
             (SELECT SUM(f.VLRDESDOB) FROM TGFFIN f
                JOIN TGFPAR p ON p.CODPARC = f.CODPARC
                 AND REGEXP_REPLACE(p.CGC_CPF,'[^0-9]','') = ixn.CNPJPARC
               WHERE f.NUMNOTA = ixn.NUMNOTA AND f.RECDESP = -1) FIN_SOMA
        FROM TGFIXN ixn
        LEFT JOIN TSIEMP emp ON emp.CODEMP = ixn.CODEMP
        LEFT JOIN (
              SELECT cab.NUMNOTA, cab.CODEMP,
                     REGEXP_REPLACE(par.CGC_CPF,'[^0-9]','') CNPJ,
                     MIN(cab.NUNOTA) NUNOTA, MIN(cab.DTMOV) DTMOV
                FROM TGFCAB cab
                JOIN TGFPAR par ON par.CODPARC = cab.CODPARC
               WHERE cab.CODTIPOPER IN (${TOPS_SQL})
                 AND cab.TIPMOV = 'C' AND cab.STATUSNOTA = 'L'
               GROUP BY cab.NUMNOTA, cab.CODEMP, REGEXP_REPLACE(par.CGC_CPF,'[^0-9]','')
             ) lanc
          ON lanc.NUMNOTA = ixn.NUMNOTA
         AND lanc.CODEMP  = ixn.CODEMP
         AND lanc.CNPJ    = ixn.CNPJPARC
        LEFT JOIN AD_NOTA_CHEGADA ch
          ON ch.NUMNOTA = ixn.NUMNOTA
         AND ch.CODEMP  = ixn.CODEMP
         AND ch.CNPJ    = ixn.CNPJPARC
       WHERE ixn.DHEMISS >= TRUNC(SYSDATE) - :dias
         AND ixn.NUMNOTA IS NOT NULL
         AND lanc.NUNOTA IS NULL
       ORDER BY ixn.DHEMISS DESC`;
    const r = await db.simpleExecute(sql, { dias });

    const notas = [];
    (r.rows || []).forEach(x => {
      const lancadaCab = x.NUNOTA != null;
      const valor = Number(x.VLRNOTA) || 0;
      const finSoma = x.FIN_SOMA != null ? Number(x.FIN_SOMA) : null;
      const chegouFin = finSoma != null && Math.abs(finSoma - valor) <= 0.05;
      const lancada = lancadaCab || chegouFin;

      // Na versao Lite: se esta lancada (seja por TGFCAB ou por Financeiro), NAO DEVE APARECER!
      if (lancada) return;

      const chegada = x.DHCHEGADA ? new Date(x.DHCHEGADA) : null;
      const chegouManual = !!x.DHCHEGADA;
      const chegou = chegouManual;
      const emissao = x.DHEMISS ? new Date(x.DHEMISS) : null;
      let diasEmissao = null;
      if (emissao) diasEmissao = Math.floor((Date.now() - emissao.getTime()) / 86400000);
      const urgente = !!(emissao && diasEmissao > PRAZO_CHEGADA && !chegou);

      notas.push({
        nuarq: x.NUARQUIVO,
        codemp: x.CODEMP, empresa: x.EMPRESA || ('Empresa ' + x.CODEMP),
        numnota: x.NUMNOTA, serie: x.SERIEDOC, cnpj: x.CNPJPARC,
        fornecedor: x.FORNECEDOR || '', valor,
        emissao: x.DHEMISS, diasEmissao,
        dhimport: x.DHIMPORT,
        chegada: x.DHCHEGADA, chegouManual, chegouFin: false, chegou,
        lancada: false, urgente,
        status: 'fila'
      });
    });

    const urgentesArr = notas.filter(n => n.urgente);
    const comChegada = notas.filter(n => n.chegou);
    const cards = {
      total: notas.length,
      chegada: comChegada.length,
      semChegada: notas.length - comChegada.length,
      urgentes: urgentesArr.length,
      valor: notas.reduce((s, n) => s + n.valor, 0),
      valorUrgente: urgentesArr.reduce((s, n) => s + n.valor, 0)
    };

    notas.sort((a, b) => (Number(b.urgente) - Number(a.urgente))
                        || ((b.diasEmissao || 0) - (a.diasEmissao || 0)));
    res.json({ ok: true, dias, prazo: PRAZO_CHEGADA, cards, notas });
  } catch (e) {
    console.error('apiDadosLite acompanhamento:', e);
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  }
}

module.exports = { paginaIndex, apiDados, marcarChegada, apiItens, paginaIndexLite, apiDadosLite };
