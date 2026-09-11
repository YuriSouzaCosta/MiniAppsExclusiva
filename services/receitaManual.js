const db = require('../config/db/oracle');

const CAMPOS = ['pix', 'cartao', 'deposito', 'boleto', 'dinheiro'];

function erro(status, message) {
  return Object.assign(new Error(message), { status });
}

function validarPeriodo(competencia, empresas) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(competencia || '')) || Number(String(competencia).slice(0, 4)) < 2000) {
    throw erro(400, 'Competência inválida.');
  }
  if (!Array.isArray(empresas) || !empresas.length || empresas.some(e => !Number.isInteger(e) || e < 1 || e > 7)) {
    throw erro(400, 'Selecione uma empresa válida.');
  }
}

function parseValor(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') {
    return isNaN(value) || value < 0 ? 0 : value;
  }
  const clean = String(value).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(clean);
  return isNaN(num) || num < 0 ? 0 : num;
}

async function carregar(competencia, empresas) {
  validarPeriodo(competencia, empresas);
  const binds = { competencia };
  const placeholders = empresas.map((e, i) => {
    binds[`e${i}`] = e;
    return `:e${i}`;
  });

  try {
    const result = await db.simpleExecute(
      `SELECT CODEMP, PIX, CARTAO, DEPOSITO, BOLETO, DINHEIRO, VERSAO, USUARIO, ATUALIZADO_EM
         FROM AD_RECEITA_MANUAL
        WHERE COMPETENCIA = TO_DATE(:competencia || '-01', 'YYYY-MM-DD')
          AND CODEMP IN (${placeholders.join(',')})`,
      binds
    );

    const registros = result.rows.map(row => ({
      empresa: Number(row.CODEMP),
      versao: Number(row.VERSAO || 1),
      valores: {
        pix: Number(row.PIX || 0),
        cartao: Number(row.CARTAO || 0),
        deposito: Number(row.DEPOSITO || 0),
        boleto: Number(row.BOLETO || 0),
        dinheiro: Number(row.DINHEIRO || 0)
      },
      usuario: row.USUARIO,
      atualizadoEm: row.ATUALIZADO_EM
    }));

    const valores = Object.fromEntries(
      CAMPOS.map(key => [
        key,
        registros.reduce((sum, r) => sum + Math.round((r.valores[key] || 0) * 100), 0) / 100
      ])
    );

    const total = CAMPOS.reduce((sum, key) => sum + Math.round(valores[key] * 100), 0) / 100;
    const faltantes = empresas.filter(e => !registros.some(r => r.empresa === e));

    return {
      tabelaExiste: true,
      competencia,
      empresas,
      registros,
      valores,
      total,
      faltantes
    };
  } catch (error) {
    if (error.errorNum === 942) {
      // Tabela não existe ainda no Oracle (ORA-00942)
      const valores = Object.fromEntries(CAMPOS.map(key => [key, 0]));
      return {
        tabelaExiste: false,
        competencia,
        empresas,
        registros: [],
        valores,
        total: 0,
        faltantes: empresas
      };
    }
    throw error;
  }
}

async function salvar({ competencia, empresa, valores, versao }, usuario) {
  validarPeriodo(competencia, [empresa]);
  const userStr = String(usuario || 'SISTEMA').trim().slice(0, 100);

  const pix = parseValor(valores?.pix);
  const cartao = parseValor(valores?.cartao);
  const deposito = parseValor(valores?.deposito);
  const boleto = parseValor(valores?.boleto);
  const dinheiro = parseValor(valores?.dinheiro);
  const total = Math.round((pix + cartao + deposito + boleto + dinheiro) * 100) / 100;

  try {
    // Verificar se já existe registro
    const checkBinds = { competencia, empresa };
    const checkRes = await db.simpleExecute(
      `SELECT VERSAO FROM AD_RECEITA_MANUAL
        WHERE CODEMP = :empresa
          AND COMPETENCIA = TO_DATE(:competencia || '-01', 'YYYY-MM-DD')`,
      checkBinds
    );

    if (checkRes.rows.length === 0) {
      // Insert
      const insertBinds = {
        empresa,
        competencia,
        pix,
        cartao,
        deposito,
        boleto,
        dinheiro,
        usuario: userStr
      };
      await db.simpleExecute(
        `INSERT INTO AD_RECEITA_MANUAL
          (CODEMP, COMPETENCIA, PIX, CARTAO, DEPOSITO, BOLETO, DINHEIRO, VERSAO, USUARIO, ATUALIZADO_EM)
         VALUES
          (:empresa, TO_DATE(:competencia || '-01', 'YYYY-MM-DD'), :pix, :cartao, :deposito, :boleto, :dinheiro, 1, :usuario, SYSTIMESTAMP)`,
        insertBinds,
        { autoCommit: true }
      );
      return {
        competencia,
        empresa,
        versao: 1,
        valores: { pix, cartao, deposito, boleto, dinheiro },
        total
      };
    } else {
      // Update
      const currentVersao = Number(checkRes.rows[0].VERSAO || 1);
      const updateBinds = {
        empresa,
        competencia,
        pix,
        cartao,
        deposito,
        boleto,
        dinheiro,
        usuario: userStr
      };
      await db.simpleExecute(
        `UPDATE AD_RECEITA_MANUAL
            SET PIX = :pix,
                CARTAO = :cartao,
                DEPOSITO = :deposito,
                BOLETO = :boleto,
                DINHEIRO = :dinheiro,
                VERSAO = VERSAO + 1,
                USUARIO = :usuario,
                ATUALIZADO_EM = SYSTIMESTAMP
          WHERE CODEMP = :empresa
            AND COMPETENCIA = TO_DATE(:competencia || '-01', 'YYYY-MM-DD')`,
        updateBinds,
        { autoCommit: true }
      );
      return {
        competencia,
        empresa,
        versao: currentVersao + 1,
        valores: { pix, cartao, deposito, boleto, dinheiro },
        total
      };
    }
  } catch (error) {
    if (error.errorNum === 942) {
      throw erro(503, 'A tabela AD_RECEITA_MANUAL ainda não foi criada no banco de dados. Execute o script receita-manual-schema.sql.');
    }
    throw error;
  }
}

module.exports = { CAMPOS, carregar, salvar, parseValor, validarPeriodo };
