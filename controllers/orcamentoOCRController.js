// controllers/orcamentoOCRController.js
// =============================================================
// Controller do módulo Orçamento OCR
// Gerencia upload de templates Excel, processamento de imagens
// via PaddleOCR (Python) e geração de planilhas preenchidas.
// =============================================================

const db = require('../config/db/oracle');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

// ----- Diretórios de upload -----
const UPLOAD_DIR_IMAGENS = path.join(__dirname, '..', 'uploads', 'imagens');
const UPLOAD_DIR_MODELOS = path.join(__dirname, '..', 'uploads', 'modelos');
const UPLOAD_DIR_PROCESSADOS = path.join(__dirname, '..', 'uploads', 'processados');
const PYTHON_SCRIPT = path.join(__dirname, '..', 'python', 'ocr_processor.py');

// Garante que os diretórios existem na inicialização
[UPLOAD_DIR_IMAGENS, UPLOAD_DIR_MODELOS, UPLOAD_DIR_PROCESSADOS].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[OCR] Diretório criado: ${dir}`);
  }
});


// =============================================================
// GET /orcamento-ocr
// Renderiza a página principal com lista de modelos
// =============================================================
async function index(req, res) {
  try {
    const result = await db.simpleExecute(
      `SELECT ID, NOME, NOME_ARQUIVO, COL_DESCRICAO, COL_QUANTIDADE,
              LINHA_INICIO, NOME_SHEET, CRIADO_POR,
              TO_CHAR(CRIADO_EM, 'DD/MM/YYYY HH24:MI') AS CRIADO_EM
         FROM AD_OCR_MODELOS
        WHERE ATIVO = 1
        ORDER BY CRIADO_EM DESC`
    );

    const modelos = result.rows || [];

    res.render('orcamento-ocr/index', {
      user: req.user,
      modelos
    });
  } catch (err) {
    console.error('[OCR] Erro ao carregar página:', err);
    res.status(500).send('Erro ao carregar módulo OCR');
  }
}


// =============================================================
// GET /orcamento-ocr/modelos
// API JSON — retorna modelos cadastrados (para AJAX)
// =============================================================
async function listarModelos(req, res) {
  try {
    const result = await db.simpleExecute(
      `SELECT ID, NOME, NOME_ARQUIVO, COL_DESCRICAO, COL_QUANTIDADE,
              LINHA_INICIO, NOME_SHEET
         FROM AD_OCR_MODELOS
        WHERE ATIVO = 1
        ORDER BY NOME`
    );

    res.json({ success: true, modelos: result.rows || [] });
  } catch (err) {
    console.error('[OCR] Erro ao listar modelos:', err);
    res.status(500).json({ success: false, error: 'Erro ao listar modelos' });
  }
}


// =============================================================
// POST /orcamento-ocr/upload-modelo
// Upload de template Excel + cadastro no Oracle
// =============================================================
async function uploadModelo(req, res) {
  let conn;
  try {
    // Valida arquivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    // Valida campos obrigatórios
    const { nome, col_descricao, col_quantidade, linha_inicio, nome_sheet } = req.body;

    if (!nome || !nome.trim()) {
      // Remove arquivo enviado se nome inválido
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Nome do modelo é obrigatório'
      });
    }

    // Valida que o arquivo é Excel válido
    try {
      const testWorkbook = new ExcelJS.Workbook();
      await testWorkbook.xlsx.readFile(req.file.path);
      if (testWorkbook.worksheets.length === 0) {
        throw new Error('Planilha vazia');
      }
    } catch (excelErr) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Arquivo Excel inválido ou corrompido'
      });
    }

    // Insere no Oracle
    conn = await db.getConnection();

    await conn.execute(
      `INSERT INTO AD_OCR_MODELOS
          (NOME, NOME_ARQUIVO, CAMINHO, COL_DESCRICAO, COL_QUANTIDADE,
           LINHA_INICIO, NOME_SHEET, CRIADO_POR, CRIADO_EM, ATIVO)
       VALUES
          (:nome, :nome_arquivo, :caminho, :col_descricao, :col_quantidade,
           :linha_inicio, :nome_sheet, :criado_por, SYSTIMESTAMP, 1)`,
      {
        nome: nome.trim(),
        nome_arquivo: req.file.originalname,
        caminho: req.file.filename,
        col_descricao: (col_descricao || 'A').toUpperCase().trim(),
        col_quantidade: (col_quantidade || 'B').toUpperCase().trim(),
        linha_inicio: parseInt(linha_inicio) || 2,
        nome_sheet: (nome_sheet || 'Sheet1').trim(),
        criado_por: req.user.username
      },
      { autoCommit: true }
    );

    console.log(`[OCR] Modelo "${nome.trim()}" cadastrado por ${req.user.username} — arquivo: ${req.file.filename}`);

    res.json({
      success: true,
      message: 'Modelo cadastrado com sucesso!'
    });
  } catch (err) {
    console.error('[OCR] Erro ao cadastrar modelo:', err);
    // Limpa arquivo em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: 'Erro ao cadastrar modelo no banco de dados'
    });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* silencioso */ }
    }
  }
}


// =============================================================
// POST /orcamento-ocr/processar
// Recebe imagem + ID do modelo, executa OCR, preenche Excel
// =============================================================
async function processarImagem(req, res) {
  try {
    // ----- Validações -----
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem enviada'
      });
    }

    const { modelo_id } = req.body;
    if (!modelo_id) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Selecione um modelo Excel'
      });
    }

    // ----- Busca modelo no Oracle -----
    const modeloResult = await db.simpleExecute(
      `SELECT ID, NOME, CAMINHO, COL_DESCRICAO, COL_QUANTIDADE,
              LINHA_INICIO, NOME_SHEET
         FROM AD_OCR_MODELOS
        WHERE ID = :id AND ATIVO = 1`,
      { id: parseInt(modelo_id) }
    );

    if (!modeloResult.rows || modeloResult.rows.length === 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        error: 'Modelo não encontrado ou inativo'
      });
    }

    const modelo = modeloResult.rows[0];
    const imagePath = req.file.path;

    console.log(`[OCR] Processando imagem: ${req.file.originalname}`);
    console.log(`[OCR] Modelo selecionado: "${modelo.NOME}" (ID: ${modelo.ID})`);
    console.log(`[OCR] Mapeamento: desc=${modelo.COL_DESCRICAO}, qtd=${modelo.COL_QUANTIDADE}, inicio=${modelo.LINHA_INICIO}`);

    // ----- Executa PaddleOCR via Python -----
    const ocrResult = await executarPython(imagePath);

    if (ocrResult.error) {
      // Registra erro no histórico
      await registrarHistorico(modelo_id, req.file.originalname, null, 0, req.user.username, 'ERRO', ocrResult.error);
      return res.status(500).json({
        success: false,
        error: 'Erro no OCR: ' + ocrResult.error
      });
    }

    const itens = Array.isArray(ocrResult) ? ocrResult : [];
    console.log(`[OCR] ${itens.length} item(ns) extraído(s) da imagem`);

    // Se não encontrou itens
    if (itens.length === 0) {
      await registrarHistorico(modelo_id, req.file.originalname, null, 0, req.user.username, 'SEM_ITENS', null);
      return res.json({
        success: true,
        itens: [],
        message: 'Nenhum item foi identificado na imagem. Tente com uma imagem mais nítida.',
        arquivo: null
      });
    }

    // ----- Verifica template no disco -----
    const templatePath = path.join(UPLOAD_DIR_MODELOS, modelo.CAMINHO);
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo de template não encontrado no disco. Faça o upload novamente.'
      });
    }

    // ----- Preenche Excel -----
    const timestamp = Date.now();
    const nomeArquivoGerado = `orcamento_${timestamp}.xlsx`;
    const caminhoGerado = path.join(UPLOAD_DIR_PROCESSADOS, nomeArquivoGerado);

    await preencherExcel(
      templatePath,
      caminhoGerado,
      itens,
      {
        colDescricao: modelo.COL_DESCRICAO || 'A',
        colQuantidade: modelo.COL_QUANTIDADE || 'B',
        linhaInicio: modelo.LINHA_INICIO || 2,
        nomeSheet: modelo.NOME_SHEET || 'Sheet1'
      }
    );

    // ----- Registra histórico no Oracle -----
    await registrarHistorico(
      modelo_id,
      req.file.originalname,
      nomeArquivoGerado,
      itens.length,
      req.user.username,
      'SUCESSO',
      null
    );

    console.log(`[OCR] Excel gerado com sucesso: ${nomeArquivoGerado} (${itens.length} itens)`);

    // ----- Retorna resultado -----
    res.json({
      success: true,
      itens,
      arquivo: nomeArquivoGerado,
      message: `${itens.length} item(ns) extraído(s) e Excel gerado com sucesso!`
    });

  } catch (err) {
    console.error('[OCR] Erro ao processar imagem:', err);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao processar imagem: ' + err.message
    });
  }
}


// =============================================================
// Executa script Python do PaddleOCR via child_process
// =============================================================
function executarPython(imagePath) {
  return new Promise((resolve) => {
    // Detecta comando Python no sistema
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    console.log(`[OCR] Executando: ${pythonCmd} ${PYTHON_SCRIPT} ${imagePath}`);

    const proc = spawn(pythonCmd, [PYTHON_SCRIPT, imagePath], {
      cwd: path.join(__dirname, '..'),
      timeout: 600000,  // Timeout estendido para 10 minutos (devido à carga no servidor)
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      // PaddleOCR envia logs de inicialização para stderr (não é erro)
      if (stderr) {
        console.log('[OCR][Python stderr]:', stderr.substring(0, 500));
      }

      if (code !== 0) {
        console.error(`[OCR] Python encerrou com código ${code}`);
        resolve({
          error: `Processo OCR falhou (código ${code}). Verifique se o Python e PaddleOCR estão instalados.`
        });
        return;
      }

      // Parseia JSON retornado pelo Python
      try {
        const trimmed = stdout.trim();
        // O Python pode imprimir warnings antes do JSON,
        // então pegamos apenas a última linha que é JSON válido
        const lines = trimmed.split('\n');
        let jsonStr = '';
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('[') || line.startsWith('{')) {
            jsonStr = line;
            break;
          }
        }

        if (!jsonStr) {
          console.error('[OCR] Nenhum JSON encontrado no stdout do Python:', stdout);
          resolve({ error: 'Resposta inválida do processador OCR' });
          return;
        }

        const result = JSON.parse(jsonStr);
        resolve(result);
      } catch (parseErr) {
        console.error('[OCR] Erro ao parsear JSON do Python:', stdout);
        resolve({ error: 'Resposta inválida do processador OCR' });
      }
    });

    proc.on('error', (err) => {
      console.error('[OCR] Erro ao executar Python:', err);
      if (err.code === 'ENOENT') {
        resolve({
          error: `Python não encontrado. Instale Python 3 e adicione ao PATH.`
        });
      } else {
        resolve({
          error: `Não foi possível executar Python: ${err.message}`
        });
      }
    });
  });
}


// =============================================================
// Preenche template Excel com itens extraídos do OCR
// =============================================================
// Helper para converter letra de coluna do Excel em índice numérico (base 1)
function excelColToNum(colLetter) {
  let num = 0;
  const str = colLetter.toUpperCase().trim();
  for (let i = 0; i < str.length; i++) {
    num = num * 26 + (str.charCodeAt(i) - 64);
  }
  return num;
}

// =============================================================
// Preenche template Excel com itens extraídos do OCR
// =============================================================
async function preencherExcel(templatePath, outputPath, itens, config) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  // Tenta pegar a sheet pelo nome configurado
  let sheet = workbook.getWorksheet(config.nomeSheet);

  // Fallback: pega a primeira sheet disponível
  if (!sheet) {
    sheet = workbook.worksheets[0];
    console.log(`[OCR] Sheet "${config.nomeSheet}" não encontrada, usando primeira sheet: "${sheet.name}"`);
  }

  if (!sheet) {
    throw new Error('Nenhuma planilha encontrada no template Excel');
  }

  const linhaInicio = config.linhaInicio || 2;
  const colDesc = config.colDescricao || 'A';
  const colQtd = config.colQuantidade || 'B';
  const totalItems = itens.length;

  console.log(`[OCR] Preenchendo sheet "${sheet.name}": ${colDesc}=descrição, ${colQtd}=quantidade, início linha ${linhaInicio}`);

  // 1. Identifica a linha que contém "TOTAL" no rodapé para saber o limite de linhas disponíveis no grid
  let totalRowIndex = -1;
  for (let r = linhaInicio; r < linhaInicio + 200; r++) {
    const row = sheet.getRow(r);
    let foundTotal = false;
    row.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value;
      if (val) {
        let textVal = '';
        if (typeof val === 'string') {
          textVal = val;
        } else if (typeof val === 'object' && val.richText) {
          textVal = val.richText.map(t => t.text).join('');
        }
        if (textVal.toUpperCase().includes('TOTAL')) {
          foundTotal = true;
        }
      }
    });
    if (foundTotal) {
      totalRowIndex = r;
      break;
    }
  }

  // 2. Insere linhas dinamicamente caso o orçamento tenha mais itens do que o espaço disponível no template
  let rowsInserted = 0;
  if (totalRowIndex !== -1) {
    const availableRows = totalRowIndex - linhaInicio;
    console.log(`[OCR] Linha do TOTAL identificada na posição: ${totalRowIndex}. Linhas do grid disponíveis: ${availableRows}, Itens extraídos: ${totalItems}`);
    
    if (totalItems > availableRows) {
      const rowsToInsert = totalItems - availableRows;
      console.log(`[OCR] Inserindo ${rowsToInsert} novas linhas antes da linha de TOTAL para empurrar o rodapé...`);
      
      const emptyRows = Array(rowsToInsert).fill([]);
      
      // Salva os merges atuais e remove (exceljs spliceRows não desloca merges)
      const oldMerges = [...(sheet.model.merges || [])];
      oldMerges.forEach(m => {
        try { sheet.unMergeCells(m); } catch(e){}
      });
      
      sheet.spliceRows(totalRowIndex, 0, ...emptyRows);
      rowsInserted = rowsToInsert;
      
      // Re-aplica os merges deslocando as linhas que estavam no TOTAL ou abaixo
      oldMerges.forEach(merge => {
        try {
          const [start, end] = merge.split(':');
          if (start && end) {
            const startMatch = start.match(/([A-Z]+)(\d+)/);
            const endMatch = end.match(/([A-Z]+)(\d+)/);
            
            let startRow = parseInt(startMatch[2]);
            let endRow = parseInt(endMatch[2]);
            
            if (startRow >= totalRowIndex) startRow += rowsToInsert;
            if (endRow >= totalRowIndex) endRow += rowsToInsert;
            
            const newMerge = `${startMatch[1]}${startRow}:${endMatch[1]}${endRow}`;
            sheet.mergeCells(newMerge);
          }
        } catch(e) {
          console.error('[OCR] Erro ao re-aplicar merge', merge, e);
        }
      });
    }
  } else {
    console.log('[OCR] Linha de TOTAL não identificada no template. Preenchendo sem inserção.');
  }

  // 3. Copia a formatação estrutural e as fórmulas de cada célula da linha de template original (linhaInicio)
  const templateRow = sheet.getRow(linhaInicio);
  const descColNum = excelColToNum(colDesc);
  const qtyColNum = excelColToNum(colQtd);

  // Preenche cada item em uma linha e replica a formatação de todas as colunas
  itens.forEach((item, i) => {
    const rowNum = linhaInicio + i;
    const currentRow = sheet.getRow(rowNum);

    // Ajusta a altura da linha igual à do template
    if (templateRow.height) {
      currentRow.height = templateRow.height;
    }

    // Varre as colunas padrão (1 a 15) do grid para replicar a formatação e as fórmulas
    for (let colIdx = 1; colIdx <= 15; colIdx++) {
      const templateCell = templateRow.getCell(colIdx);
      const currentCell = currentRow.getCell(colIdx);

      // Copia estilos de forma profunda (resolve perda de formatação e bordas em novas linhas)
      if (templateCell.style) {
        currentCell.style = JSON.parse(JSON.stringify(templateCell.style));
      } else {
        currentCell.font = templateCell.font;
        currentCell.fill = templateCell.fill;
        currentCell.border = templateCell.border;
        currentCell.alignment = templateCell.alignment;
        currentCell.numFmt = templateCell.numFmt;
      }

      // Se for a coluna da descrição
      if (colIdx === descColNum) {
        currentCell.value = item.descricao || '';
      }
      // Se for a coluna da quantidade
      else if (colIdx === qtyColNum) {
        currentCell.value = item.quantidade || 0;
      }
      // Se for a coluna do número do item (ex: coluna A ou B contendo 1, "1°", "1º", etc.)
      else if (
        (colIdx === 1 || colIdx === 2) &&
        templateCell.value &&
        (templateCell.value === 1 ||
         String(templateCell.value).trim() === '1' ||
         String(templateCell.value).trim() === '1°' ||
         String(templateCell.value).trim() === '1º')
      ) {
        const valStr = String(templateCell.value).trim();
        if (typeof templateCell.value === 'number') {
          currentCell.value = rowNum - linhaInicio + 1;
        } else if (valStr.includes('°')) {
          currentCell.value = `${rowNum - linhaInicio + 1}°`;
        } else if (valStr.includes('º')) {
          currentCell.value = `${rowNum - linhaInicio + 1}º`;
        } else {
          currentCell.value = rowNum - linhaInicio + 1;
        }
      }
      // Se for uma fórmula (como as de preço total de cada item)
      else if (templateCell.type === ExcelJS.ValueType.Formula || (templateCell.value && (templateCell.value.formula || templateCell.value.sharedFormula))) {
        const baseFormula = templateCell.formula;
        if (baseFormula) {
          const regex = new RegExp(`([A-Za-z]+)${linhaInicio}\\b`, 'g');
          const cleanFormula = baseFormula.replace(regex, `$1${rowNum}`);
          currentCell.value = { formula: cleanFormula };
        }
      }
      // Copia valor estático padrão (como a unidade "UN", "UND", etc.) se não for nulo/indefinido
      else if (templateCell.value !== null && templateCell.value !== undefined) {
        currentCell.value = templateCell.value;
      }
    }

    currentRow.commit();
  });

  // 4. Atualiza as fórmulas de SUM no rodapé para abranger o novo intervalo de itens
  if (totalRowIndex !== -1) {
    const finalTotalRowIndex = totalRowIndex + rowsInserted;
    const totalRow = sheet.getRow(finalTotalRowIndex);
    
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.value && cell.value.formula) {
        const formulaText = cell.value.formula;
        // Procura por fórmulas SUM, ex: SUM(G12:G27) ou SUM(F10:F50)
        const sumRegex = /SUM\(([A-Za-z]+)\d+:([A-Za-z]+)\d+\)/i;
        const match = formulaText.match(sumRegex);
        if (match) {
          const colLetter = match[1]; // Pega a letra da coluna, ex: G
          const startRow = linhaInicio;
          const endRow = linhaInicio + totalItems - 1;
          const newFormula = `SUM(${colLetter}${startRow}:${colLetter}${endRow})`;
          console.log(`[OCR] Atualizando fórmula de soma na célula ${cell.address}: ${formulaText} -> ${newFormula}`);
          cell.value = { formula: newFormula };
        }
      }
    });
    totalRow.commit();
  }

  // Salva arquivo gerado
  await workbook.xlsx.writeFile(outputPath);
  console.log(`[OCR] Excel salvo com sucesso em: ${outputPath} (${itens.length} linhas preenchidas)`);
}


// =============================================================
// Registra processamento no histórico (Oracle)
// Não-crítico: erros aqui não devem interromper o fluxo
// =============================================================
async function registrarHistorico(modeloId, imagemOriginal, arquivoGerado, itensExtraidos, usuario, status, logTexto) {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.execute(
      `INSERT INTO AD_OCR_HISTORICO
          (MODELO_ID, IMAGEM_ORIGINAL, ARQUIVO_GERADO, ITENS_EXTRAIDOS,
           PROCESSADO_POR, PROCESSADO_EM, STATUS, LOG_TEXTO)
       VALUES
          (:modelo_id, :imagem, :arquivo, :itens,
           :usuario, SYSTIMESTAMP, :status, :log_texto)`,
      {
        modelo_id: parseInt(modeloId),
        imagem: imagemOriginal || '',
        arquivo: arquivoGerado || '',
        itens: itensExtraidos || 0,
        usuario: usuario || '',
        status: status || 'SUCESSO',
        log_texto: logTexto || ''
      },
      { autoCommit: true }
    );
  } catch (dbErr) {
    // Não-crítico: apenas loga o erro
    console.error('[OCR] Erro ao salvar histórico (não-crítico):', dbErr.message);
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* silencioso */ }
    }
  }
}


// =============================================================
// GET /orcamento-ocr/download/:arquivo
// Serve o arquivo Excel gerado para download
// =============================================================
async function downloadArquivo(req, res) {
  try {
    const { arquivo } = req.params;

    // Sanitiza nome do arquivo (previne path traversal)
    const nomeSeguro = path.basename(arquivo);

    // Valida extensão
    if (!nomeSeguro.endsWith('.xlsx')) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de arquivo inválido'
      });
    }

    const filePath = path.join(UPLOAD_DIR_PROCESSADOS, nomeSeguro);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo não encontrado. Pode ter sido removido.'
      });
    }

    console.log(`[OCR] Download solicitado: ${nomeSeguro} por ${req.user.username}`);
    res.download(filePath, nomeSeguro);
  } catch (err) {
    console.error('[OCR] Erro ao fazer download:', err);
    res.status(500).json({
      success: false,
      error: 'Erro ao baixar arquivo'
    });
  }
}


// =============================================================
// DELETE /orcamento-ocr/modelo/:id
// Soft-delete do modelo (ATIVO = 0) + remove arquivo do disco
// =============================================================
async function deletarModelo(req, res) {
  let conn;
  try {
    const { id } = req.params;

    // Busca modelo para obter caminho do arquivo
    const result = await db.simpleExecute(
      'SELECT CAMINHO, NOME FROM AD_OCR_MODELOS WHERE ID = :id',
      { id: parseInt(id) }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Modelo não encontrado'
      });
    }

    const modelo = result.rows[0];

    // Soft delete no Oracle
    conn = await db.getConnection();
    await conn.execute(
      'UPDATE AD_OCR_MODELOS SET ATIVO = 0 WHERE ID = :id',
      { id: parseInt(id) },
      { autoCommit: true }
    );

    // Remove arquivo do disco
    const filePath = path.join(UPLOAD_DIR_MODELOS, modelo.CAMINHO);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[OCR] Arquivo removido do disco: ${filePath}`);
    }

    console.log(`[OCR] Modelo "${modelo.NOME}" (ID: ${id}) deletado por ${req.user.username}`);

    res.json({
      success: true,
      message: 'Modelo removido com sucesso'
    });
  } catch (err) {
    console.error('[OCR] Erro ao deletar modelo:', err);
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar modelo'
    });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* silencioso */ }
    }
  }
}


// =============================================================
// GET /orcamento-ocr/historico
// API JSON — retorna últimos processamentos
// =============================================================
async function listarHistorico(req, res) {
  try {
    const result = await db.simpleExecute(
      `SELECT h.ID, h.IMAGEM_ORIGINAL, h.ARQUIVO_GERADO, h.ITENS_EXTRAIDOS,
              h.PROCESSADO_POR, h.STATUS,
              TO_CHAR(h.PROCESSADO_EM, 'DD/MM/YYYY HH24:MI') AS PROCESSADO_EM,
              m.NOME AS MODELO_NOME
         FROM AD_OCR_HISTORICO h
         LEFT JOIN AD_OCR_MODELOS m ON m.ID = h.MODELO_ID
        ORDER BY h.PROCESSADO_EM DESC
        FETCH FIRST 50 ROWS ONLY`
    );

    res.json({ success: true, historico: result.rows || [] });
  } catch (err) {
    console.error('[OCR] Erro ao listar histórico:', err);
    res.status(500).json({ success: false, error: 'Erro ao listar histórico' });
  }
}


// =============================================================
// Exporta todas as funções do controller
// =============================================================
module.exports = {
  index,
  listarModelos,
  uploadModelo,
  processarImagem,
  downloadArquivo,
  deletarModelo,
  listarHistorico
};
