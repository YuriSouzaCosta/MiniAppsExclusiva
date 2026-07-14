-- =============================================================
-- BACKUP da versão anterior (extraída do banco em 14/07/2026)
-- Última DDL no banco: 09/07/2026 07:28
-- Motivo da troca: STP_OBTEMID quebra com ORA-01422 quando a
-- TGFNUM tem mais de uma linha para ARQUIVO='TGFCAB'.
-- =============================================================
CREATE OR REPLACE PROCEDURE JIVA.STP_GERARPEDCOMPRA_IMPORT_YSC (
    P_NUM_PEDIDO   NUMBER,
    P_MENSAGEM     OUT VARCHAR2
)
AS
    PARAM_EMPRESA      NUMBER (10);
    v_dhtipvenda       DATE;
    PARAM_PARCEIRO     VARCHAR2 (4000);
    PARAM_CODTIPOPER   NUMBER := 5;  -- Tipo de operação para compra padrão
    v_DTPREVENT        DATE;
    V_DTFATUR          DATE;
    V_NUNOTA           INT;
    V_CODLOCAL         INT := 110000;
    V_CODTIPOPER       INT;
    V_DHTIPOPER        DATE;
    V_CODPARC          NUMBER;
    V_CODTIPVENDA      NUMBER;
    V_VALORTOTAL       NUMBER;
    var_sequencia      NUMBER;

    -- Variáveis de controle de tipo de operação (TOP)
    var_tipmov         CHAR (1);
    var_atualest       CHAR (1);
    var_tipatualest    INT;
    var_tipatualfin    CHAR (1);
    var_provisao       CHAR (1);
    errmsg             VARCHAR2 (4000);
    V_MODELOCAB TGFCAB%rowtype;

    -- Controle de data atual
    v_data_atual       DATE := SYSDATE;
BEGIN


    ---------------------------------------------------------------------
    --    Busca informações da TOP (Tipo de Operação)
    ---------------------------------------------------------------------
    BEGIN
        SELECT tipmov,
               t.atualest,
               t.tipatualfin,
               MAX (dhalter) AS dhalter
          INTO var_tipmov,
               var_atualest,
               var_tipatualfin,
               V_DHTIPOPER
          FROM tgftop t
         WHERE t.codtipoper = PARAM_CODTIPOPER
      GROUP BY t.tipmov, t.atualest, t.tipatualfin;

        IF V_DHTIPOPER >= v_data_atual THEN
            V_DHTIPOPER := v_data_atual - 1 / 86400;
        END IF;

    END;

    ---------------------------------------------------------------------
    --    Ajusta tipo de atualização de estoque e provisão
    ---------------------------------------------------------------------
    IF var_atualest = 'N' THEN
        var_tipatualest := 0;
    ELSIF var_atualest = 'E' THEN
        var_tipatualest := 1;
    ELSIF var_atualest = 'B' THEN
        var_tipatualest := -1;
    ELSE
        var_tipatualest := 0;
    END IF;

    var_provisao := CASE var_tipatualfin WHEN 'P' THEN 'S' ELSE 'N' END;

    ---------------------------------------------------------------------
    --    Verifica se o pedido existe
    ---------------------------------------------------------------------
    BEGIN
        SELECT codemp,
               dataentrega,
               datafaturamento,
               cod_parceiro,
               parceiro,
               cod_forma_pagto,
               VLRTOTAL
          INTO PARAM_EMPRESA,
               v_DTPREVENT,
               V_DTFATUR,
               V_CODPARC,
               PARAM_PARCEIRO,
               V_CODTIPVENDA,
               V_VALORTOTAL
          FROM cabecalho_pedido_ysc
         WHERE NUMERO_PEDIDO = P_NUM_PEDIDO;

    END;

    ---------------------------------------------------------------------
    --    Busca data/hora da tipvenda
    ---------------------------------------------------------------------
    BEGIN
        SELECT MAX (dhalter)
          INTO v_dhtipvenda
          FROM tgftpv
         WHERE codtipvenda = V_CODTIPVENDA;

        IF v_dhtipvenda >= v_data_atual THEN
            v_dhtipvenda := v_data_atual - 1 / 86400;
        END IF;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            v_dhtipvenda := v_data_atual - 1 / 86400;
    END;

    ---------------------------------------------------------------------
    --    Gera chave NUNOTA
    ---------------------------------------------------------------------
    stp_obtemid('TGFCAB', V_NUNOTA);

    ---------------------------------------------------------------------
    --    Insere cabeçalho da nota/pedido
    ---------------------------------------------------------------------
    BEGIN


            SELECT * INTO V_MODELOCAB FROM TGFCAB B WHERE B.NUNOTA = 833332;
                V_MODELOCAB.DTNEG := TRUNC(v_data_atual);
                V_MODELOCAB.DTMOV := TRUNC(v_data_atual);
                V_MODELOCAB.CODEMP := PARAM_EMPRESA;
                V_MODELOCAB.CODPARC := V_CODPARC;
                V_MODELOCAB.CODTIPOPER := PARAM_CODTIPOPER;
                V_MODELOCAB.DHTIPOPER := V_DHTIPOPER;
                V_MODELOCAB.CODTIPVENDA := V_CODTIPVENDA;
                V_MODELOCAB.DHTIPVENDA := V_DHTIPVENDA;
                V_MODELOCAB.OBSERVACAO := 'GERADO AUTOMATICAMENTE - PEDIDO ' || P_NUM_PEDIDO;
                V_MODELOCAB.DTALTER := V_DATA_ATUAL;
                V_MODELOCAB.DTFATUR := V_DTFATUR;
                V_MODELOCAB.CODNAT := 2010000;
                V_MODELOCAB.DTPREVENT := V_DTPREVENT;
                V_MODELOCAB.NUNOTA := V_NUNOTA;
                V_MODELOCAB.TIPMOV := 'O';
                V_MODELOCAB.VLRNOTA := V_VALORTOTAL;
            insert into TGFCAB values V_MODELOCAB;


    END;

    ---------------------------------------------------------------------
    --    Insere os itens
    ---------------------------------------------------------------------
    FOR P IN (
        SELECT CODPROD, QTD_PEDIR, VLR_TOTAL
          FROM PEDIDO_PROCESSADO_YSC
         WHERE NUMERO_PEDIDO = P_NUM_PEDIDO
           AND QTD_PEDIR > 0
    )
    LOOP
        BEGIN
            SELECT NVL(MAX(sequencia), 0)
              INTO var_sequencia
              FROM tgfite
             WHERE nunota = V_NUNOTA;

            var_sequencia := var_sequencia + 1;

            UPDATE tgfpro SET codvol = 'UN' WHERE CODPROD = P.CODPROD;

            INSERT INTO tgfite (
                nunota, sequencia, codemp, codprod, codlocalorig,
                usoprod, qtdneg, vlrunit, vlrtot,
                pendente, vlrdesc, codvol, atualestoque, statusnota
            )
            VALUES (
                V_NUNOTA, var_sequencia, PARAM_EMPRESA, P.CODPROD, V_CODLOCAL,
                'R', P.QTD_PEDIR, ROUND(P.VLR_TOTAL / P.QTD_PEDIR, 2),
                P.VLR_TOTAL, 'N', 0, 'UN', var_tipatualest, 'A'
            );
        EXCEPTION
            WHEN OTHERS THEN
                P_MENSAGEM := 'Erro ao inserir item: ' || SQLERRM;
        END;
    END LOOP;

    ---------------------------------------------------------------------
    --    Atualiza o NUNOTA do pedido original
    ---------------------------------------------------------------------
    UPDATE cabecalho_pedido_ysc
       SET nunota = V_NUNOTA
     WHERE numero_pedido = P_NUM_PEDIDO;

    COMMIT;
    P_MENSAGEM := 'Pedido gerado com sucesso! NUNOTA: ' || V_NUNOTA;


END;
/
