// Executa o DDL do módulo Baixa de Boletos (cria sequence + tabela + índice).
// Uso: node scratch/run_ddl.js
process.env.DOTENV_CONFIG_QUIET = 'true';
const db = require('./config/db/oracle');

const stmts = [
  'CREATE SEQUENCE JIVA.SEQ_AD_BAIXA_BOLETOS START WITH 1 INCREMENT BY 1 NOCACHE',
  `CREATE TABLE JIVA.AD_BAIXA_BOLETOS (
    ID              NUMBER DEFAULT JIVA.SEQ_AD_BAIXA_BOLETOS.NEXTVAL NOT NULL,
    NOME_ARQUIVO    VARCHAR2(255),
    PAGINA          NUMBER,
    TIPO_PAGAMENTO  VARCHAR2(20),
    LINHA_DIGITAVEL VARCHAR2(80),
    CODIGO_BARRA    VARCHAR2(60),
    VALOR_BOLETO    NUMBER(14,2),
    VALOR_TITULO    NUMBER(14,2),
    VENCIMENTO      DATE,
    CNPJ            VARCHAR2(20),
    FORNECEDOR      VARCHAR2(120),
    CODEMP          NUMBER,
    NUNOTA          NUMBER,
    NUFIN           NUMBER,
    PARCELA         VARCHAR2(20),
    CONFIANCA       VARCHAR2(20),
    BANCO_ORIGEM    VARCHAR2(80),
    AGENCIA_ORIGEM  VARCHAR2(20),
    CONTA_ORIGEM    VARCHAR2(30),
    BANCO_DESTINO   VARCHAR2(80),
    AGENCIA_DESTINO VARCHAR2(20),
    CONTA_DESTINO   VARCHAR2(30),
    CHAVE_PIX       VARCHAR2(100),
    ID_TRANSACAO    VARCHAR2(100),
    STATUS          VARCHAR2(30),
    BAIXADO_POR     VARCHAR2(60),
    BAIXADO_EM      TIMESTAMP,
    LOG_TEXTO       VARCHAR2(1000),
    CONSTRAINT PK_AD_BAIXA_BOLETOS PRIMARY KEY (ID)
  )`,
  'CREATE INDEX IX_AD_BAIXA_BOLETOS_EM ON JIVA.AD_BAIXA_BOLETOS (BAIXADO_EM DESC)'
];

(async () => {
  let conn;
  try {
    await db.init();
    conn = await db.getConnection();
    for (const s of stmts) {
      try {
        await conn.execute(s);
        console.log('OK:', s.slice(0, 45) + '...');
      } catch (e) {
        if (e.errorNum === 955) { console.log('Já existe (ignorado):', s.slice(0, 45)); }
        else throw e;
      }
    }
    await conn.commit();
    console.log('DDL concluído.');
    await db.close();
    process.exit(0);
  } catch (e) {
    console.error('Falha:', e.message);
    process.exit(1);
  }
})();
