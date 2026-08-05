-- ============================================================
-- DDL do módulo "Baixa de Boletos por PDF" (boleto e PIX)
-- Executar UMA VEZ no banco (Oracle / Sankhya), schema JIVA
-- ============================================================

CREATE SEQUENCE JIVA.SEQ_AD_BAIXA_BOLETOS START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE TABLE JIVA.AD_BAIXA_BOLETOS (
  ID              NUMBER DEFAULT JIVA.SEQ_AD_BAIXA_BOLETOS.NEXTVAL NOT NULL,
  NOME_ARQUIVO    VARCHAR2(255),
  PAGINA          NUMBER,
  TIPO_PAGAMENTO  VARCHAR2(20),    -- BOLETO | PIX
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
  CONFIANCA       VARCHAR2(20),    -- exato | aproximado
  BANCO_ORIGEM    VARCHAR2(80),
  AGENCIA_ORIGEM  VARCHAR2(20),
  CONTA_ORIGEM    VARCHAR2(30),
  BANCO_DESTINO   VARCHAR2(80),
  AGENCIA_DESTINO VARCHAR2(20),
  CONTA_DESTINO   VARCHAR2(30),
  CHAVE_PIX       VARCHAR2(100),
  ID_TRANSACAO    VARCHAR2(100),
  STATUS          VARCHAR2(30),    -- BAIXADO | JA_PAGO | NAO_ENCONTRADO | ERRO
  BAIXADO_POR     VARCHAR2(60),
  BAIXADO_EM      TIMESTAMP,
  LOG_TEXTO       VARCHAR2(1000),
  CONSTRAINT PK_AD_BAIXA_BOLETOS PRIMARY KEY (ID)
);

CREATE INDEX IX_AD_BAIXA_BOLETOS_EM ON JIVA.AD_BAIXA_BOLETOS (BAIXADO_EM DESC);

-- ============================================================
-- Se a tabela JÁ FOI criada antes da versão com PIX/banco/conta,
-- execute apenas os ALTERs abaixo:
-- ============================================================
-- ALTER TABLE JIVA.AD_BAIXA_BOLETOS ADD TIPO_PAGAMENTO  VARCHAR2(20);
-- ALTER TABLE JIVA.AD_BAIXA_BOLETOS ADD BANCO_ORIGEM    VARCHAR2(80);
-- ALTER TABLE JIVA.AD_BAIXA_BOLETOS ADD AGENCIA_ORIGEM  VARCHAR2(20);
-- ALTER TABLE JIVA.AD_BAIXA_BOLETOS ADD CONTA_ORIGEM    VARCHAR2(30);
-- ALTER TABLE JIVA.AD_BAIXA_BOLETOS ADD BANCO_DESTINO   VARCHAR2(80);
-- ALTER TABLE JIVA.AD_BAIXA_BOLETOS ADD AGENCIA_DESTINO VARCHAR2(20);
-- ALTER TABLE JIVA.AD_BAIXA_BOLETOS ADD CONTA_DESTINO   VARCHAR2(30);
-- ALTER TABLE JIVA.AD_BAIXA_BOLETOS ADD CHAVE_PIX       VARCHAR2(100);
-- ALTER TABLE JIVA.AD_BAIXA_BOLETOS ADD ID_TRANSACAO    VARCHAR2(100);

-- ============================================================
-- Mapeamento CNPJ do boleto → CNPJ da nota fiscal
-- Necessário quando o fornecedor emite boleto por um CNPJ
-- (filial bancária/holding) diferente do CNPJ da nota (parceiro
-- cadastrado no Sankhya / TGFPAR).
-- Executar UMA VEZ após a criação da tabela principal acima.
-- ============================================================

CREATE SEQUENCE JIVA.SEQ_AD_CNPJ_BOLETO_MAP START WITH 1 INCREMENT BY 1 NOCACHE;

-- Relação N:1 — um CNPJ de cobrança pode corresponder a vários CNPJs de nota
-- (ex.: grupo com filiais que emitem NFs por CNPJs distintos mas cobram pelo mesmo boleto)
CREATE TABLE JIVA.AD_CNPJ_BOLETO_MAP (
  ID           NUMBER DEFAULT JIVA.SEQ_AD_CNPJ_BOLETO_MAP.NEXTVAL NOT NULL,
  CNPJ_BOLETO  VARCHAR2(20) NOT NULL,   -- CNPJ que aparece no boleto (só dígitos)
  CNPJ_NOTA    VARCHAR2(20) NOT NULL,   -- CNPJ do parceiro no Sankhya (só dígitos)
  DESCRICAO    VARCHAR2(200),           -- ex.: "Grupo X – filial SP cobra pelo holding"
  CRIADO_POR   VARCHAR2(60),
  CRIADO_EM    TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT PK_AD_CNPJ_BOLETO_MAP PRIMARY KEY (ID),
  CONSTRAINT UQ_AD_CNPJ_BOLETO_MAP UNIQUE (CNPJ_BOLETO, CNPJ_NOTA)  -- par deve ser único
);

CREATE INDEX IX_AD_CNPJ_BOLETO_MAP_CNPJ ON JIVA.AD_CNPJ_BOLETO_MAP (CNPJ_BOLETO);

-- ============================================================
-- Se a tabela AD_CNPJ_BOLETO_MAP já existe e quer apenas
-- adicionar novos mapeamentos manualmente:
-- ============================================================
-- INSERT INTO JIVA.AD_CNPJ_BOLETO_MAP (CNPJ_BOLETO, CNPJ_NOTA, DESCRICAO, CRIADO_POR)
--   VALUES ('00000000000100', '00000000000191', 'Fornecedor X – holding bancária', 'DBA');
-- COMMIT;
