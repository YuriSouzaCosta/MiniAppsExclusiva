// controllers/baixaBoletosController.js
// Módulo "Baixa de Boletos/PIX": recebe PDFs de boleto e comprovantes de
// Pix (PDF ou imagem), extrai os dados via python/ocr_boleto.py
// (PaddleOCR + PyMuPDF + zxing-cpp), casa com títulos em aberto do TGFFIN
// e faz a baixa (UPDATE TGFFIN setando DHBAIXA), registrando tudo em
// AD_BAIXA_BOLETOS. Acesso ADMIN + Compras (ASS_COMPRA).
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const db = require('../config/db/oracle');

const UPLOAD_DIR_BOLETOS = path.join(__dirname, '..', 'uploads', 'boletos');
const PYTHON_SCRIPT = path.join(__dirname, '..', 'python', 'ocr_boleto.py');

// Garante que o diretório de upload existe
if (!fs.existsSync(UPLOAD_DIR_BOLETOS)) {
  fs.mkdirSync(UPLOAD_DIR_BOLETOS, { recursive: true });
  console.log('[Boleto] Diretório criado:', UPLOAD_DIR_BOLETOS);
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------
function pagina(req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'baixaBoletos', 'index.html'));
}

// ---------------------------------------------------------------------
// Executa o script Python de OCR do boleto
// ---------------------------------------------------------------------
function executarPythonBoleto(pdfPath) {
  return new Promise((resolve) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonCmd, [PYTHON_SCRIPT, pdfPath], {
      cwd: path.join(__dirname, '..'),
      timeout: 600000,               // até 10 min (PaddleOCR é pesado)
      env: { ...process.env }
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (stderr) console.log('[Boleto][Python stderr]:', stderr.substring(0, 500));
      // O PaddleOCR pode poluir o stdout; pega a última linha que parece JSON
      const lines = stdout.split('\n').filter((l) => l.trim());
      let json = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{') || line.startsWith('[')) {
          try { json = JSON.parse(line); break; } catch (_) { /* ignora */ }
        }
      }
      if (!json && stdout.trim()) {
        try { json = JSON.parse(stdout.trim()); } catch (_) { /* ignora */ }
      }
      if (json) return resolve(json);
      return resolve({ error: `Falha ao processar (exit ${code}): ${(stderr || stdout).substring(0, 300)}` });
    });
    proc.on('error', (err) => resolve({ error: String(err.message || err) }));
  });
}

// ---------------------------------------------------------------------
// Queries de casamento com o TGFFIN (títulos em aberto de entrada)
// ---------------------------------------------------------------------
const SEL_TITULO = `
  SELECT f.NUFIN, f.NUNOTA, f.CODEMP, f.CODPARC, f.DESDOBRAMENTO, f.DTVENC, f.VLRDESDOB,
         f.NOSSONUM, f.CODBARRA, p.NOMEPARC, p.CGC_CPF, cab.NUMNOTA, f.DHBAIXA BAIXA,
         (SELECT COUNT(*) FROM TGFFIN f2
           WHERE f2.NUNOTA = f.NUNOTA AND f2.RECDESP = -1 AND NVL(f2.PROVISAO,'N') = 'N') NPARC
    FROM TGFFIN f
    JOIN TGFPAR p ON p.CODPARC = f.CODPARC
    LEFT JOIN TGFCAB cab ON cab.NUNOTA = f.NUNOTA`;

const SQL_MATCH_BARCODE = `
  ${SEL_TITULO}
   WHERE f.RECDESP = -1 AND NVL(f.PROVISAO,'N') = 'N' AND f.DHBAIXA IS NULL
     AND REGEXP_REPLACE(NVL(f.CODBARRA,''),'[^0-9]','') = :cb
     AND ROWNUM = 1`;

const SQL_MATCH_FALLBACK = `
  ${SEL_TITULO}
   WHERE f.RECDESP = -1 AND NVL(f.PROVISAO,'N') = 'N' AND f.DHBAIXA IS NULL
     AND REGEXP_REPLACE(NVL(p.CGC_CPF,''),'[^0-9]','') = :cnpj
     AND ABS(f.VLRDESDOB - :valor) <= 0.50
     AND ABS(TRUNC(f.DTVENC) - TO_DATE(:venc,'YYYY-MM-DD')) <= 3
     AND ROWNUM = 1`;

// Para PIX sem data confiável: casa só por CNPJ/CPF + valor (último recurso)
const SQL_MATCH_CNPJ_VALOR = `
  ${SEL_TITULO}
   WHERE f.RECDESP = -1 AND NVL(f.PROVISAO,'N') = 'N' AND f.DHBAIXA IS NULL
     AND REGEXP_REPLACE(NVL(p.CGC_CPF,''),'[^0-9]','') = :cnpj
     AND ABS(f.VLRDESDOB - :valor) <= 0.50
     AND ROWNUM = 1`;

// Busca títulos em aberto de um parceiro específico (para seleção manual de NUFIN)
const SQL_BUSCAR_CODPARC = `
  ${SEL_TITULO}
   WHERE f.CODPARC = :codparc
     AND f.RECDESP = -1 AND NVL(f.PROVISAO,'N') = 'N' AND f.DHBAIXA IS NULL
   ORDER BY ABS(f.VLRDESDOB - :valor), f.DTVENC
   FETCH FIRST 15 ROWS ONLY`;

// O cadastro de conta varia entre versões do Sankhya. Nesta base, a conta
// visível é TSICTA.CODCTABCO e a chave que referencia TGFMBC é
// TSICTA.CODCTABCOINT. Outras instalações podem usar NUCONTA/NUMCONTA.
let contaSchemaPromise;

async function obterSchemaConta(conn) {
  if (!contaSchemaPromise) {
    contaSchemaPromise = conn.execute(
      `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS
         WHERE OWNER = :owner AND TABLE_NAME = 'TSICTA'`,
      { owner: (process.env.ORACLE_USER || 'JIVA').toUpperCase() }
    ).then(r => {
      const cols = new Set((r.rows || []).map(row => row.COLUMN_NAME));
      return {
        conta: cols.has('NUCONTA') ? 'NUCONTA' : cols.has('NUMCONTA') ? 'NUMCONTA' :
          cols.has('CODCTABCO') ? 'CODCTABCO' : null,
        chave: cols.has('CODCTABCOINT') ? 'CODCTABCOINT' : 'CODCTABCO',
        agencia: cols.has('CODAGE') ? 'CODAGE' : cols.has('AGENCIA') ? 'AGENCIA' :
          cols.has('CODAGENCIA') ? 'CODAGENCIA' : null
      };
    }).catch(err => {
      contaSchemaPromise = null;
      throw err;
    });
  }
  return contaSchemaPromise;
}

function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function codigoBarrasDaLinhaDigitavel(valor) {
  const linha = somenteDigitos(valor);
  // Cobrança bancária: 47 dígitos (3 campos com DV + DV geral + fator/valor).
  // A linha não é o código de barras: os DVs dos campos precisam ser removidos
  // e o DV geral/fator precisam voltar às posições do padrão de 44 dígitos.
  if (linha.length !== 47) return '';
  return linha.slice(0, 4) + linha[32] + linha.slice(33, 47) +
    linha.slice(4, 9) + linha.slice(10, 20) + linha.slice(21, 31);
}

async function buscarContaBancaria(conn, contaOcr, agenciaOcr) {
  const schema = await obterSchemaConta(conn);
  if (!schema.conta) return null;

  const contaCompleta = somenteDigitos(contaOcr);
  // O dígito verificador frequentemente não é armazenado em TSICTA.
  const contaSemDv = contaCompleta.length > 1 ? contaCompleta.slice(0, -1) : contaCompleta;
  const agencia = somenteDigitos(agenciaOcr).replace(/^0+(?=\d)/, '');
  const colConta = schema.conta;
  const colAgencia = schema.agencia;
  const agenciaSelect = colAgencia ? `${colAgencia} AS AGENCIA` : "'' AS AGENCIA";
  const agenciaExpr = colAgencia
    ? `REGEXP_REPLACE(NVL(${colAgencia},''),'[^0-9]','')`
    : "''";

  const r = await conn.execute(`
    SELECT ${schema.chave} AS CODCTA, DESCRICAO, ${colConta} AS NUCONTA, ${agenciaSelect}
      FROM TSICTA
     WHERE REGEXP_REPLACE(NVL(${colConta},''),'[^0-9]','') IN (:conta_completa, :conta_sem_dv)
       AND NVL(ATIVA, 'S') = 'S'
     ORDER BY
       CASE WHEN REGEXP_REPLACE(NVL(${colConta},''),'[^0-9]','') = :conta_completa THEN 0 ELSE 1 END,
       CASE WHEN LTRIM(${agenciaExpr}, '0') = :agencia THEN 0 ELSE 1 END,
       CODCTABCO
     FETCH FIRST 1 ROWS ONLY`,
  { conta_completa: contaCompleta, conta_sem_dv: contaSemDv, agencia });
  return r.rows && r.rows[0] ? r.rows[0] : null;
}

// Mapeamento CNPJ boleto → CNPJs de nota (N:1 — um CNPJ de cobrança pode ter vários CNPJs de nota)
const SQL_CNPJ_MAP = `
  SELECT REGEXP_REPLACE(CNPJ_NOTA,'[^0-9]','') AS CNPJ_NOTA
    FROM AD_CNPJ_BOLETO_MAP
   WHERE REGEXP_REPLACE(CNPJ_BOLETO,'[^0-9]','') = :cnpj_boleto
   ORDER BY CRIADO_EM`;

// ---------------------------------------------------------------------
// Monta o objeto de match a partir de uma linha do TGFFIN
// ---------------------------------------------------------------------
function montarTitulo(row) {
  const valor = Number(row.VLRDESDOB) || 0;
  const parc = row.DESDOBRAMENTO != null ? Number(row.DESDOBRAMENTO) : 0;
  const nparc = Number(row.NPARC) || 1;
  return {
    nufin: row.NUFIN,
    nunota: row.NUNOTA,
    codemp: row.CODEMP,
    codparc: row.CODPARC,
    desdobramento: row.DESDOBRAMENTO,
    nparc,
    parcLabel: parc === 0 ? 'única' : (parc + '/' + nparc),
    fornecedor: row.NOMEPARC || '',
    cnpj: row.CGC_CPF || '',
    valor,
    vencimento: row.DTVENC ? row.DTVENC.toISOString().slice(0, 10) : null,
    numnota: row.NUMNOTA || null,
    nossonum: row.NOSSONUM || '',
    codbarra: row.CODBARRA || '',
    pago: row.BAIXA != null
  };
}

/**
 * Busca todos os CNPJs de nota correspondentes ao CNPJ do boleto.
 * Um CNPJ de cobrança pode cobrir N CNPJs de nota (filiais do mesmo grupo).
 * Retorna array vazio se não houver mapeamento ou se a tabela não existir.
 */
async function buscarCnpjsMapeados(conn, cnpjBoleto) {
  if (!cnpjBoleto) return [];
  try {
    const r = await conn.execute(SQL_CNPJ_MAP, { cnpj_boleto: cnpjBoleto });
    if (r.rows && r.rows.length) {
      return r.rows.map(row => row.CNPJ_NOTA).filter(Boolean);
    }
  } catch (e) {
    // Tabela ainda não criada — ignora silenciosamente
    if (!String(e.message || e).includes('ORA-00942')) {
      console.warn('[Boleto] Erro ao consultar AD_CNPJ_BOLETO_MAP:', e.message);
    }
  }
  return [];
}

async function casarBoleto(conn, boleto) {
  const tipo = boleto.tipo || 'BOLETO';
  const boletoValor = boleto.valor != null ? Number(boleto.valor) : null;
  const boletoVenc = boleto.vencimento || null;
  const boletoCnpj = boleto.cnpj ? String(boleto.cnpj).replace(/\D/g, '') : null;
  const avisos = [];

  // 1) Código de barras / linha digitável — confiança exata (apenas boleto)
  if (tipo === 'BOLETO') {
    // Alguns ERPs gravam CODBARRA com 44 dígitos; outros guardam a linha
    // digitável (47). Tentamos ambos e também a conversão correta da linha.
    const cods = [
      boleto.barcode,
      boleto.linha_digitavel,
      codigoBarrasDaLinhaDigitavel(boleto.linha_digitavel)
    ].map(somenteDigitos).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    for (const cb of cods) {
      const r = await conn.execute(SQL_MATCH_BARCODE, { cb });
      if (r.rows && r.rows.length) {
        const t = montarTitulo(r.rows[0]);
        if (boletoValor != null && t.valor != null && Math.abs(boletoValor - t.valor) > 0.01) {
          avisos.push(`Valor do boleto (${boletoValor.toFixed(2)}) difere do título (${t.valor.toFixed(2)})`);
        }
        return { confianca: 'exato', titulo: t, avisos };
      }
    }
  }

  // Verifica mapeamento de CNPJ (fornecedor com vários CNPJs de nota e 1 CNPJ de cobrança)
  const cnpjsMapeados = boletoCnpj ? await buscarCnpjsMapeados(conn, boletoCnpj) : [];
  if (cnpjsMapeados.length) {
    avisos.push(`CNPJ do boleto (${boletoCnpj}) mapeado para ${cnpjsMapeados.length} CNPJ(s) de nota: ${cnpjsMapeados.join(', ')}`);
  }
  // Lista de CNPJs a tentar: primeiro o do boleto, depois todos os mapeados
  const cnpjsCandidatos = [boletoCnpj, ...cnpjsMapeados].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  // 2) CNPJ/CPF + valor (±0,50) + vencimento (±3 dias)
  if (boletoValor != null && boletoVenc) {
    for (const cnpj of cnpjsCandidatos) {
      const r = await conn.execute(SQL_MATCH_FALLBACK, {
        cnpj, valor: boletoValor, venc: boletoVenc
      });
      if (r.rows && r.rows.length) {
        const t = montarTitulo(r.rows[0]);
        if (boletoValor != null && t.valor != null && Math.abs(boletoValor - t.valor) > 0.01) {
          avisos.push(`Valor do comprovante (${boletoValor.toFixed(2)}) difere do título (${t.valor.toFixed(2)})`);
        }
        if (cnpjsMapeados.includes(cnpj)) {
          avisos.push('Casado pelo CNPJ da nota fiscal (diferente do CNPJ do boleto) — confira antes de baixar');
        } else {
          avisos.push('Casado por CNPJ + valor + vencimento (confira antes de baixar)');
        }
        return { confianca: 'aproximado', titulo: t, avisos };
      }
    }
  }

  // 3) PIX sem data confiável: casa por CNPJ/CPF + valor apenas (último recurso)
  if (tipo === 'PIX' && boletoValor != null) {
    for (const cnpj of cnpjsCandidatos) {
      const r = await conn.execute(SQL_MATCH_CNPJ_VALOR, {
        cnpj, valor: boletoValor
      });
      if (r.rows && r.rows.length) {
        const t = montarTitulo(r.rows[0]);
        if (boletoValor != null && t.valor != null && Math.abs(boletoValor - t.valor) > 0.01) {
          avisos.push(`Valor do comprovante (${boletoValor.toFixed(2)}) difere do título (${t.valor.toFixed(2)})`);
        }
        if (cnpjsMapeados.includes(cnpj)) {
          avisos.push('Casado pelo CNPJ da nota fiscal (sem data — confira antes de baixar)');
        } else {
          avisos.push('Casado por CNPJ + valor (sem conferência de data — confira antes de baixar)');
        }
        return { confianca: 'aproximado', titulo: t, avisos };
      }
    }
  }

  return { confianca: null, titulo: null, avisos: [] };
}

// ---------------------------------------------------------------------
// Upload: processa os PDFs e devolve os boletos extraídos + casamento
// ---------------------------------------------------------------------
async function apiUpload(req, res) {
  const files = req.files || [];
  if (!files.length) {
    return res.json({ ok: false, erro: 'Nenhum PDF enviado' });
  }

  // 1) OCR dos PDFs (SEM segurar conexão com o banco — o PaddleOCR demora)
  const arquivos = [];
  for (const file of files) {
    const arquivoItem = { nome: file.originalname };
    try {
      const ocrResult = await executarPythonBoleto(file.path);
      if (ocrResult.error) {
        arquivoItem.erro = ocrResult.error;
      } else {
        arquivoItem.escaneado = !!ocrResult.escaneado;
        arquivoItem.boletos = (ocrResult.pages || []).map(pg => pg.error
          ? { page: pg.page, erro: pg.error }
          : {
              page: pg.page,
              tipo: pg.tipo || 'BOLETO',
              barcode: pg.barcode || '',
              linha_digitavel: pg.linha_digitavel || '',
              valor: pg.valor != null ? Number(pg.valor) : null,
              vencimento: pg.vencimento || null,
              cnpj: pg.cnpj || '',
              fornecedor: pg.fornecedor || '',
              nosso_numero: pg.nosso_numero || '',
              banco_origem: pg.banco_origem || '',
              agencia_origem: pg.agencia_origem || '',
              conta_origem: pg.conta_origem || '',
              banco_destino: pg.banco_destino || '',
              agencia_destino: pg.agencia_destino || '',
              conta_destino: pg.conta_destino || '',
              chave_pix: pg.chave_pix || '',
              id_transacao: pg.id_transacao || '',
              match: null
            });
      }
    } catch (e) {
      arquivoItem.erro = String(e.message || e);
    }
    arquivos.push(arquivoItem);
  }

  // 2) Casamento com o TGFFIN (conexão curta)
  let conn;
  try {
    conn = await db.getConnection();
    for (const arq of arquivos) {
      for (const b of (arq.boletos || [])) {
        if (b.erro || b.match) continue;
        b.match = await casarBoleto(conn, b);
      }
    }

    // Tenta identificar a conta bancária (TSICTA) pelo número da conta de origem do comprovante
    for (const arq of arquivos) {
      for (const b of (arq.boletos || [])) {
        if (b.erro || !b.conta_origem) continue;
        const nuconta = String(b.conta_origem).replace(/\D/g, '');
        const agencia = String(b.agencia_origem || '').replace(/\D/g, '');
        if (!nuconta) continue;
        try {
          const conta = await buscarContaBancaria(conn, nuconta, agencia);
          if (conta) {
            b.codcta_sugerido  = conta.CODCTA;
            b.nuconta          = conta.NUCONTA;
            b.agencia          = conta.AGENCIA;
            b.desconta         = conta.DESCRICAO;
          }
        } catch (e) {
          // Não impede o título de ser exibido, mas devolve o motivo para
          // diagnóstico quando a estrutura do cadastro divergir do esperado.
          b.aviso_conta = `Não foi possível sugerir a conta: ${String(e.message || e)}`;
        }
      }
    }

    res.json({ ok: true, arquivos });
  } catch (e) {
    console.error('apiUpload baixaBoletos:', e);
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  } finally {
    if (conn) { try { await conn.close(); } catch (_) {} }
  }
}

// ---------------------------------------------------------------------
// Baixa: confirma os itens marcados → UPDATE TGFFIN + histórico
// ---------------------------------------------------------------------
const SQL_INSERT_HISTORICO = `
  INSERT INTO AD_BAIXA_BOLETOS
    (ID, NOME_ARQUIVO, PAGINA, TIPO_PAGAMENTO, LINHA_DIGITAVEL, CODIGO_BARRA, VALOR_BOLETO, VALOR_TITULO,
     VENCIMENTO, CNPJ, FORNECEDOR, CODEMP, NUNOTA, NUFIN, PARCELA, CONFIANCA,
     BANCO_ORIGEM, AGENCIA_ORIGEM, CONTA_ORIGEM, BANCO_DESTINO, AGENCIA_DESTINO, CONTA_DESTINO,
     CHAVE_PIX, ID_TRANSACAO,
     STATUS, BAIXADO_POR, BAIXADO_EM, LOG_TEXTO)
  VALUES
    (JIVA.SEQ_AD_BAIXA_BOLETOS.NEXTVAL, :nome_arquivo, :pagina, :tipo_pagamento, :linha, :codbarra, :valor_boleto, :valor_titulo,
     :vencimento, :cnpj, :fornecedor, :codemp, :nunota, :nufin, :parcela, :confianca,
     :banco_origem, :agencia_origem, :conta_origem, :banco_destino, :agencia_destino, :conta_destino,
     :chave_pix, :id_transacao,
     :status, :usuario, SYSTIMESTAMP, :log_texto)`;

async function apiBaixar(req, res) {
  const itens = req.body.itens || [];
  if (!itens.length) {
    return res.json({ ok: false, erro: 'Nenhum item selecionado para baixa' });
  }

  let conn;
  try {
    conn = await db.getConnection();

    // Verifica se a tabela de histórico existe (DDL baixa_boletos_ddl.sql)
    try {
      await conn.execute('SELECT 1 FROM AD_BAIXA_BOLETOS WHERE ROWNUM = 1');
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes('ORA-00942')) {
        return res.status(500).json({
          ok: false,
          erro: 'Tabela AD_BAIXA_BOLETOS ainda não criada. Execute baixa_boletos_ddl.sql no banco.'
        });
      }
      throw e;
    }

    const resultados = [];

    for (const it of itens) {
      // SAVEPOINT por item — erro de um não derruba os demais
      await conn.execute('SAVEPOINT baixa_item');
      const nufin = Number(it.nufin) || null;
      let status = 'ERRO';
      let mensagem = '';
      let title = null;

      try {
        if (!nufin) {
          status = 'NAO_ENCONTRADO';
          mensagem = 'Sem NUFIN (boleto não casado)';
        } else {
          const t = await conn.execute(`${SEL_TITULO} WHERE f.NUFIN = :nufin AND f.RECDESP = -1 AND NVL(f.PROVISAO,'N') = 'N'`, { nufin });
          title = t.rows && t.rows[0] ? montarTitulo(t.rows[0]) : null;

          if (!title) {
            status = 'NAO_ENCONTRADO';
            mensagem = 'Título não encontrado';
          } else if (title.pago) {
            status = 'JA_PAGO';
            mensagem = 'Título já baixado';
          } else {
            // Conta bancária por item (codcta vem do frontend por linha)
            const codcta = Number(it.codcta) || null;
            if (!codcta) {
              status = 'ERRO';
              mensagem = 'Conta bancária não selecionada para este título';
              throw Object.assign(new Error(mensagem), { handled: true });
            }

            // Cria movimento bancário na TGFMBC (exigido pelo trigger TRG_UPT_TGFFIN_NUBCO)
            const boleto = it.boleto || {};
            const hist = `Baixa boleto - ${it.arquivo || ''}${boleto.page ? ' p' + boleto.page : ''}`;
            const nubco = await criarMovimentoBancario(conn, {
              nufin,
              codcta,
              valor:    title.valor,
              codemp:   title.codemp,
              historico: hist
            });

            const u = await conn.execute(
              `UPDATE TGFFIN
                  SET DHBAIXA = SYSDATE,
                      DHMOV = SYSDATE,
                      NUBCO = :nubco,
                      VLRBAIXA = VLRDESDOB,
                      CODTIPOPERBAIXA = 3,
                      DHTIPOPERBAIXA = TO_DATE('2004-01-01', 'YYYY-MM-DD')
                WHERE NUFIN = :nufin AND DHBAIXA IS NULL`,
              { nubco, nufin }
            );
            if (!u.rowsAffected) {
              status = 'JA_PAGO';
              mensagem = 'Já baixado (concorrência)';
            } else {
              status = 'BAIXADO';
              mensagem = `OK (NUBCO=${nubco})`;
            }
          }
        }

        // Registra histórico (boleto + título)
        const boleto = it.boleto || {};
        const vencDate = (title && title.vencimento)
          ? new Date(title.vencimento + 'T00:00:00')
          : (boleto.vencimento ? new Date(String(boleto.vencimento).slice(0, 10) + 'T00:00:00') : null);
        await conn.execute(SQL_INSERT_HISTORICO, {
          nome_arquivo: it.arquivo || '',
          pagina: boleto.page != null ? Number(boleto.page) : null,
          tipo_pagamento: boleto.tipo || 'BOLETO',
          linha: boleto.linha_digitavel || '',
          codbarra: boleto.barcode || '',
          valor_boleto: boleto.valor != null ? Number(boleto.valor) : null,
          valor_titulo: title ? title.valor : null,
          vencimento: vencDate,
          cnpj: (title ? title.cnpj : '') || boleto.cnpj || '',
          fornecedor: (title ? title.fornecedor : '') || boleto.fornecedor || '',
          codemp: title ? title.codemp : null,
          nunota: title ? title.nunota : null,
          nufin,
          parcela: title ? title.parcLabel : null,
          confianca: it.confianca || '',
          banco_origem: boleto.banco_origem || '',
          agencia_origem: boleto.agencia_origem || '',
          conta_origem: boleto.conta_origem || '',
          banco_destino: boleto.banco_destino || '',
          agencia_destino: boleto.agencia_destino || '',
          conta_destino: boleto.conta_destino || '',
          chave_pix: boleto.chave_pix || '',
          id_transacao: boleto.id_transacao || '',
          status,
          usuario: req.user.username,
          log_texto: (mensagem || '').slice(0, 1000)
        });

        resultados.push({ nufin, status, mensagem });
      } catch (e) {
        try { await conn.execute('ROLLBACK TO SAVEPOINT baixa_item'); } catch (_) {}
        if (!e.handled) {
          const em = String(e.message || e);
          const msg = em.includes('ORA-00942')
            ? 'Tabela AD_BAIXA_BOLETOS ainda não criada — rode o DDL (baixa_boletos_ddl.sql)'
            : em.slice(0, 300);
          resultados.push({ nufin, status: 'ERRO', mensagem: msg });
        } else {
          resultados.push({ nufin, status, mensagem });
        }
      }
    }

    await conn.commit();
    res.json({ ok: true, total: resultados.length, resultados });
  } catch (e) {
    console.error('apiBaixar baixaBoletos:', e);
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  } finally {
    if (conn) { try { await conn.close(); } catch (_) {} }
  }
}

// ---------------------------------------------------------------------
// Histórico dos últimos processamentos
// ---------------------------------------------------------------------
async function apiHistorico(req, res) {
  try {
    const r = await db.simpleExecute(`
      SELECT ID, NOME_ARQUIVO, PAGINA, TIPO_PAGAMENTO, LINHA_DIGITAVEL, CODIGO_BARRA,
             VALOR_BOLETO, VALOR_TITULO,
             TO_CHAR(VENCIMENTO,'YYYY-MM-DD') VENCIMENTO, CNPJ, FORNECEDOR,
             CODEMP, NUNOTA, NUFIN, PARCELA, CONFIANCA, STATUS, BAIXADO_POR,
             BANCO_ORIGEM, AGENCIA_ORIGEM, CONTA_ORIGEM, BANCO_DESTINO, AGENCIA_DESTINO, CONTA_DESTINO,
             CHAVE_PIX, ID_TRANSACAO,
             TO_CHAR(BAIXADO_EM,'DD/MM/YYYY HH24:MI') BAIXADO_EM, LOG_TEXTO
        FROM AD_BAIXA_BOLETOS
       ORDER BY BAIXADO_EM DESC
       FETCH FIRST 50 ROWS ONLY`);
    res.json({ ok: true, historico: r.rows || [] });
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('ORA-00942')) {
      return res.json({ ok: true, historico: [], aviso: 'Tabela AD_BAIXA_BOLETOS ainda não criada' });
    }
    console.error('apiHistorico baixaBoletos:', e);
    res.status(500).json({ ok: false, erro: msg });
  }
}

// ---------------------------------------------------------------------
// Lista contas bancárias disponíveis (TSICTA) para o seletor de baixa
// ---------------------------------------------------------------------
async function apiListarContas(req, res) {
  let conn;
  try {
    conn = await db.getConnection();

    // Descobre quais colunas existem na TSICTA neste ambiente
    const colsR = await conn.execute(
      `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS
        WHERE OWNER = :owner AND TABLE_NAME = 'TSICTA'`,
      { owner: (process.env.ORACLE_USER || 'JIVA').toUpperCase() }
    );
    const cols = new Set((colsR.rows || []).map(r => r.COLUMN_NAME));

    // Monta SELECT com as colunas que existem. Nesta base a chave interna é
    // CODCTABCOINT e o número da conta fica em CODCTABCO.
    const extra = [
      cols.has('NUCONTA')   ? 'NUCONTA'                   : cols.has('NUMCONTA')   ? 'NUMCONTA AS NUCONTA'   :
        cols.has('CODCTABCO') ? 'CODCTABCO AS NUCONTA'     : "'' AS NUCONTA",
      cols.has('CODAGE')    ? 'CODAGE    AS AGENCIA'      : cols.has('AGENCIA')    ? 'AGENCIA'               :
        cols.has('CODAGENCIA') ? 'CODAGENCIA AS AGENCIA'  : "'' AS AGENCIA",
      cols.has('CODEMP')    ? 'CODEMP'                    : "NULL AS CODEMP",
    ].join(', ');

    const r = await conn.execute(
      `SELECT ${cols.has('CODCTABCOINT') ? 'CODCTABCOINT' : 'CODCTABCO'} AS CODCTA,
              DESCRICAO, ${extra}
         FROM TSICTA
        WHERE NVL(ATIVA, 'S') = 'S'
        ORDER BY DESCRICAO`
    );
    res.json({ ok: true, contas: r.rows || [] });
  } catch (e) {
    console.error('[Contas] Erro ao listar TSICTA:', e.message);
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  } finally {
    if (conn) { try { await conn.close(); } catch (_) {} }
  }
}

// ---------------------------------------------------------------------
// Cria registro na TGFMBC (obrigatório pelo trigger TRG_UPT_TGFFIN_NUBCO)
// Retorna o NUBCO gerado para linkar no UPDATE do TGFFIN.
// ---------------------------------------------------------------------
async function criarMovimentoBancario(conn, { codcta, valor, historico }) {
  // Tenta a sequência padrão; se não existir, usa MAX+1 como fallback
  let nubco;
  try {
    const r = await conn.execute(`SELECT JIVA.SEQ_TGFMBC.NEXTVAL AS N FROM DUAL`);
    nubco = r.rows[0].N;
  } catch (_) {
    try {
      const seqR = await conn.execute(
        `SELECT SEQUENCE_NAME FROM ALL_SEQUENCES
          WHERE SEQUENCE_OWNER = 'JIVA' AND SEQUENCE_NAME LIKE '%MBC%' AND ROWNUM = 1`
      );
      if (seqR.rows && seqR.rows[0]) {
        const seqName = seqR.rows[0].SEQUENCE_NAME;
        const r2 = await conn.execute(`SELECT JIVA."${seqName}".NEXTVAL AS N FROM DUAL`);
        nubco = r2.rows[0].N;
      }
    } catch (_2) { /* ignora */ }
    if (!nubco) {
      const maxR = await conn.execute(`SELECT NVL(MAX(NUBCO),0)+1 AS N FROM TGFMBC`);
      nubco = maxR.rows[0].N;
    }
  }

  // TGFMBC desta base usa CODCTABCOINT/VLRLANC; não possui CODCTA, CODEMP,
  // NUFIN, DHMOV ou VLRMOV. Reaproveita a parametrização já usada nos últimos
  // lançamentos da própria conta, evitando TOP ou tipo de lançamento inventados.
  const modelo = await conn.execute(`
    SELECT CODLANC, CODTIPOPER, DHTIPOPER
      FROM TGFMBC
     WHERE CODCTABCOINT = :codcta
     ORDER BY NUBCO DESC FETCH FIRST 1 ROWS ONLY`, { codcta: Number(codcta) });
  if (!modelo.rows || !modelo.rows.length) {
    throw new Error('Não há movimento anterior para parametrizar a conta bancária selecionada');
  }
  const usuario = await conn.execute(
    `SELECT CODUSU FROM TSIUSU WHERE UPPER(NOMEUSU) = UPPER(:usuario)`,
    { usuario: String(process.env.BAIXA_USUARIO_SANKHYA || 'ADMIN') }
  );
  const codusu = usuario.rows && usuario.rows[0] ? usuario.rows[0].CODUSU : 0;
  const m = modelo.rows[0];
  await conn.execute(`
    INSERT INTO TGFMBC
      (NUBCO, CODLANC, DTLANC, CODTIPOPER, DHTIPOPER, HISTORICO,
       CODCTABCOINT, VLRLANC, CONCILIADO, ORIGMOV, RECDESP,
       DTALTER, DTINCLUSAO, CODUSU)
    VALUES
      (:nubco, :codlanc, SYSDATE, :codtipoper, :dhtipoper, :hist,
       :codcta, :vlr, 'N', 'F', -1, SYSDATE, SYSDATE, :codusu)`,
    { nubco, codlanc: m.CODLANC, codtipoper: m.CODTIPOPER, dhtipoper: m.DHTIPOPER,
      codcta: Number(codcta), vlr: Math.abs(Number(valor) || 0),
      hist: (historico || 'Baixa de boleto').slice(0, 45), codusu }
  );

  return nubco;
}

// ---------------------------------------------------------------------
// Busca dados do parceiro por CODPARC (auto-fill da linha de revisão)
// ---------------------------------------------------------------------
async function apiBuscarParceiro(req, res) {
  const codparc = Number(req.params.codparc) || null;
  if (!codparc) return res.status(400).json({ ok: false, erro: 'codparc inválido' });
  let conn;
  try {
    conn = await db.getConnection();
    const r = await conn.execute(
      `SELECT CODPARC, NOMEPARC, REGEXP_REPLACE(CGC_CPF,'[^0-9]','') AS CGC_CPF
         FROM TGFPAR WHERE CODPARC = :codparc`,
      { codparc }
    );
    if (!r.rows || !r.rows.length) return res.json({ ok: false, erro: 'Parceiro não encontrado' });
    const p = r.rows[0];
    res.json({ ok: true, parceiro: { codparc: p.CODPARC, nome: p.NOMEPARC, cnpj: p.CGC_CPF } });
  } catch (e) {
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  } finally {
    if (conn) { try { await conn.close(); } catch (_) {} }
  }
}

// ---------------------------------------------------------------------
// Busca títulos em aberto por CODPARC (para seleção manual de NUFIN na revisão)
// ---------------------------------------------------------------------
async function apiBuscarPorCodparc(req, res) {
  const codparc = Number(req.body.codparc) || null;
  const valor   = req.body.valor != null ? Number(req.body.valor) : 0;
  if (!codparc) return res.status(400).json({ ok: false, erro: 'codparc inválido' });

  let conn;
  try {
    conn = await db.getConnection();
    const r = await conn.execute(SQL_BUSCAR_CODPARC, { codparc, valor });
    const titulos = (r.rows || []).map(montarTitulo);
    res.json({ ok: true, titulos });
  } catch (e) {
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  } finally {
    if (conn) { try { await conn.close(); } catch (_) {} }
  }
}

// ---------------------------------------------------------------------
// CRUD do mapeamento CNPJ boleto → CNPJ nota (AD_CNPJ_BOLETO_MAP)
// ---------------------------------------------------------------------

async function apiListarMapeamentos(req, res) {
  try {
    const r = await db.simpleExecute(`
      SELECT ID,
             REGEXP_REPLACE(CNPJ_BOLETO,'[^0-9]','') AS CNPJ_BOLETO,
             REGEXP_REPLACE(CNPJ_NOTA,  '[^0-9]','') AS CNPJ_NOTA,
             DESCRICAO, CRIADO_POR,
             TO_CHAR(CRIADO_EM,'DD/MM/YYYY HH24:MI') CRIADO_EM
        FROM AD_CNPJ_BOLETO_MAP
       ORDER BY CRIADO_EM DESC`);
    res.json({ ok: true, mapeamentos: r.rows || [] });
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('ORA-00942')) {
      return res.json({ ok: true, mapeamentos: [], aviso: 'Tabela AD_CNPJ_BOLETO_MAP ainda não criada — execute o DDL' });
    }
    res.status(500).json({ ok: false, erro: msg });
  }
}

async function apiCriarMapeamento(req, res) {
  const { cnpj_boleto, cnpj_nota, descricao } = req.body || {};
  const cb = cnpj_boleto ? String(cnpj_boleto).replace(/\D/g, '') : '';
  const cn = cnpj_nota   ? String(cnpj_nota).replace(/\D/g, '')   : '';
  if (!cb || !cn) {
    return res.status(400).json({ ok: false, erro: 'cnpj_boleto e cnpj_nota são obrigatórios' });
  }
  if (cb.length < 11 || cn.length < 11) {
    return res.status(400).json({ ok: false, erro: 'CNPJ/CPF inválido (mínimo 11 dígitos)' });
  }
  let conn;
  try {
    conn = await db.getConnection();
    await conn.execute(`
      INSERT INTO AD_CNPJ_BOLETO_MAP (CNPJ_BOLETO, CNPJ_NOTA, DESCRICAO, CRIADO_POR)
      VALUES (:cb, :cn, :desc, :usr)`,
      { cb, cn, desc: (descricao || '').slice(0, 200), usr: req.user.username }
    );
    await conn.commit();
    res.json({ ok: true, mensagem: 'Mapeamento criado com sucesso' });
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('ORA-00001')) {
      return res.status(409).json({ ok: false, erro: 'Esse par CNPJ boleto + CNPJ nota já está cadastrado' });
    }
    if (msg.includes('ORA-00942')) {
      return res.status(500).json({ ok: false, erro: 'Tabela AD_CNPJ_BOLETO_MAP não existe — execute o DDL' });
    }
    res.status(500).json({ ok: false, erro: msg });
  } finally {
    if (conn) { try { await conn.close(); } catch (_) {} }
  }
}

async function apiExcluirMapeamento(req, res) {
  const id = Number(req.params.id) || null;
  if (!id) return res.status(400).json({ ok: false, erro: 'ID inválido' });
  let conn;
  try {
    conn = await db.getConnection();
    const r = await conn.execute('DELETE FROM AD_CNPJ_BOLETO_MAP WHERE ID = :id', { id });
    await conn.commit();
    if (!r.rowsAffected) return res.status(404).json({ ok: false, erro: 'Mapeamento não encontrado' });
    res.json({ ok: true, mensagem: 'Mapeamento excluído' });
  } catch (e) {
    res.status(500).json({ ok: false, erro: String(e.message || e) });
  } finally {
    if (conn) { try { await conn.close(); } catch (_) {} }
  }
}

module.exports = { pagina, apiUpload, apiBaixar, apiHistorico, apiListarContas, apiBuscarParceiro, apiBuscarPorCodparc, apiListarMapeamentos, apiCriarMapeamento, apiExcluirMapeamento };
