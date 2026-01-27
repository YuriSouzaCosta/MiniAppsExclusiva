const db = require('../../config/db/oracle');
const oracledb = require('oracledb');

// ========== VIEW ROUTES ==========

async function index(req, res) {
    console.log('=== ANALISE TRANSFERENCIAS INDEX - Rota acessada ===');
    res.render('analise-transferencias/index', { user: req.user });
}

// ========== API ENDPOINTS ==========

// Buscar transferências pendentes
async function buscarTransferenciasPendentes(req, res) {
    console.log('=== BUSCAR TRANSFERENCIAS PENDENTES - API chamada ===');
    let conn;

    try {
        conn = await db.getConnection();

        // TODO: Ajustar query conforme estrutura real da tabela de transferências
        // Esta é uma query de exemplo
        const query = `
            SELECT 
                T.ID_TRANSFERENCIA,
                T.CODPROD,
                P.DESCRPROD,
                P.REFERENCIA,
                T.EMP_ORIGEM,
                LO.RAZAOSOCIAL AS EMPRESA_ORIGEM,
                T.LOCAL_ORIGEM,
                LO.DESCRLOCAL AS DESC_LOCAL_ORIGEM,
                T.EMP_DESTINO,
                LD.RAZAOSOCIAL AS EMPRESA_DESTINO,
                T.LOCAL_DESTINO,
                LD.DESCRLOCAL AS DESC_LOCAL_DESTINO,
                T.QUANTIDADE,
                TO_CHAR(T.DATA_CRIACAO, 'DD/MM/YYYY HH24:MI') AS DATA_CRIACAO,
                T.USUARIO,
                T.STATUS
            FROM TRANSFERENCIAS T
            LEFT JOIN VW_CONSULTA_SITE_YSC P ON T.CODPROD = P.CODPROD
            LEFT JOIN VW_MIRROR_EST_YSC LO ON T.EMP_ORIGEM = LO.CODEMP AND T.LOCAL_ORIGEM = LO.CODLOCAL
            LEFT JOIN VW_MIRROR_EST_YSC LD ON T.EMP_DESTINO = LD.CODEMP AND T.LOCAL_DESTINO = LD.CODLOCAL
            WHERE T.STATUS = 'PENDENTE'
            ORDER BY T.DATA_CRIACAO DESC
        `;

        const result = await conn.execute(query, {}, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });

        console.log('Transferências pendentes encontradas:', result.rows.length);
        res.json(result.rows);

    } catch (err) {
        console.error('Erro ao buscar transferências pendentes:', err);
        // Retornar array vazio em caso de erro (tabela pode não existir ainda)
        res.json([]);
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {
                console.error('Erro ao fechar conexão:', e);
            }
        }
    }
}

// Buscar transferências finalizadas
async function buscarTransferenciasFinalizadas(req, res) {
    console.log('=== BUSCAR TRANSFERENCIAS FINALIZADAS - API chamada ===');
    const { limit = 50, offset = 0 } = req.query;
    let conn;

    try {
        conn = await db.getConnection();

        const query = `
            SELECT * FROM (
                SELECT 
                    T.ID_TRANSFERENCIA,
                    T.CODPROD,
                    P.DESCRPROD,
                    P.REFERENCIA,
                    T.EMP_ORIGEM,
                    LO.RAZAOSOCIAL AS EMPRESA_ORIGEM,
                    T.LOCAL_ORIGEM,
                    LO.DESCRLOCAL AS DESC_LOCAL_ORIGEM,
                    T.EMP_DESTINO,
                    LD.RAZAOSOCIAL AS EMPRESA_DESTINO,
                    T.LOCAL_DESTINO,
                    LD.DESCRLOCAL AS DESC_LOCAL_DESTINO,
                    T.QUANTIDADE,
                    TO_CHAR(T.DATA_CRIACAO, 'DD/MM/YYYY HH24:MI') AS DATA_CRIACAO,
                    TO_CHAR(T.DATA_FINALIZACAO, 'DD/MM/YYYY HH24:MI') AS DATA_FINALIZACAO,
                    T.USUARIO,
                    T.STATUS,
                    ROW_NUMBER() OVER (ORDER BY T.DATA_FINALIZACAO DESC) AS RN
                FROM TRANSFERENCIAS T
                LEFT JOIN VW_CONSULTA_SITE_YSC P ON T.CODPROD = P.CODPROD AND ROWNUM = 1
                LEFT JOIN VW_MIRROR_EST_YSC LO ON T.EMP_ORIGEM = LO.CODEMP AND T.LOCAL_ORIGEM = LO.CODLOCAL AND ROWNUM = 1
                LEFT JOIN VW_MIRROR_EST_YSC LD ON T.EMP_DESTINO = LD.CODEMP AND T.LOCAL_DESTINO = LD.CODLOCAL AND ROWNUM = 1
                WHERE T.STATUS = 'FINALIZADA'
            )
            WHERE RN BETWEEN :offset + 1 AND :offset + :limit
        `;

        const result = await conn.execute(
            query,
            { 
                limit: parseInt(limit), 
                offset: parseInt(offset) 
            },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        console.log('Transferências finalizadas encontradas:', result.rows.length);
        res.json(result.rows);

    } catch (err) {
        console.error('Erro ao buscar transferências finalizadas:', err);
        res.json([]);
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {
                console.error('Erro ao fechar conexão:', e);
            }
        }
    }
}

// Buscar análise por período
async function buscarAnalisePorPeriodo(req, res) {
    console.log('=== BUSCAR ANALISE POR PERIODO - API chamada ===');
    const { dataInicio, dataFim } = req.query;
    let conn;

    try {
        conn = await db.getConnection();

        const query = `
            SELECT 
                TO_CHAR(T.DATA_CRIACAO, 'DD/MM/YYYY') AS DATA,
                COUNT(*) AS TOTAL_TRANSFERENCIAS,
                SUM(T.QUANTIDADE) AS QUANTIDADE_TOTAL,
                COUNT(CASE WHEN T.STATUS = 'PENDENTE' THEN 1 END) AS PENDENTES,
                COUNT(CASE WHEN T.STATUS = 'FINALIZADA' THEN 1 END) AS FINALIZADAS
            FROM TRANSFERENCIAS T
            WHERE 1=1
                ${dataInicio ? "AND T.DATA_CRIACAO >= TO_DATE(:dataInicio, 'YYYY-MM-DD')" : ''}
                ${dataFim ? "AND T.DATA_CRIACAO <= TO_DATE(:dataFim, 'YYYY-MM-DD')" : ''}
            GROUP BY TO_CHAR(T.DATA_CRIACAO, 'DD/MM/YYYY')
            ORDER BY TO_CHAR(T.DATA_CRIACAO, 'DD/MM/YYYY') DESC
        `;

        const bindParams = {};
        if (dataInicio) bindParams.dataInicio = dataInicio;
        if (dataFim) bindParams.dataFim = dataFim;

        const result = await conn.execute(query, bindParams, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });

        console.log('Análise por período encontrada:', result.rows.length);
        res.json(result.rows);

    } catch (err) {
        console.error('Erro ao buscar análise por período:', err);
        res.json([]);
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {
                console.error('Erro ao fechar conexão:', e);
            }
        }
    }
}

// Buscar análise por produto
async function buscarAnalisePorProduto(req, res) {
    console.log('=== BUSCAR ANALISE POR PRODUTO - API chamada ===');
    let conn;

    try {
        conn = await db.getConnection();

        const query = `
            SELECT 
                T.CODPROD,
                P.DESCRPROD,
                P.REFERENCIA,
                COUNT(*) AS TOTAL_TRANSFERENCIAS,
                SUM(T.QUANTIDADE) AS QUANTIDADE_TOTAL,
                COUNT(CASE WHEN T.STATUS = 'PENDENTE' THEN 1 END) AS PENDENTES,
                COUNT(CASE WHEN T.STATUS = 'FINALIZADA' THEN 1 END) AS FINALIZADAS
            FROM TRANSFERENCIAS T
            LEFT JOIN VW_CONSULTA_SITE_YSC P ON T.CODPROD = P.CODPROD AND ROWNUM = 1
            GROUP BY T.CODPROD, P.DESCRPROD, P.REFERENCIA
            ORDER BY TOTAL_TRANSFERENCIAS DESC
        `;

        const result = await conn.execute(query, {}, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });

        console.log('Análise por produto encontrada:', result.rows.length);
        res.json(result.rows);

    } catch (err) {
        console.error('Erro ao buscar análise por produto:', err);
        res.json([]);
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {
                console.error('Erro ao fechar conexão:', e);
            }
        }
    }
}

// Buscar análise por local
async function buscarAnalisePorLocal(req, res) {
    console.log('=== BUSCAR ANALISE POR LOCAL - API chamada ===');
    let conn;

    try {
        conn = await db.getConnection();

        const query = `
            SELECT 
                T.EMP_ORIGEM,
                LO.RAZAOSOCIAL AS EMPRESA_ORIGEM,
                T.LOCAL_ORIGEM,
                LO.DESCRLOCAL AS DESC_LOCAL_ORIGEM,
                T.EMP_DESTINO,
                LD.RAZAOSOCIAL AS EMPRESA_DESTINO,
                T.LOCAL_DESTINO,
                LD.DESCRLOCAL AS DESC_LOCAL_DESTINO,
                COUNT(*) AS TOTAL_TRANSFERENCIAS,
                SUM(T.QUANTIDADE) AS QUANTIDADE_TOTAL
            FROM TRANSFERENCIAS T
            LEFT JOIN VW_MIRROR_EST_YSC LO ON T.EMP_ORIGEM = LO.CODEMP AND T.LOCAL_ORIGEM = LO.CODLOCAL AND ROWNUM = 1
            LEFT JOIN VW_MIRROR_EST_YSC LD ON T.EMP_DESTINO = LD.CODEMP AND T.LOCAL_DESTINO = LD.CODLOCAL AND ROWNUM = 1
            GROUP BY 
                T.EMP_ORIGEM, LO.RAZAOSOCIAL, T.LOCAL_ORIGEM, LO.DESCRLOCAL,
                T.EMP_DESTINO, LD.RAZAOSOCIAL, T.LOCAL_DESTINO, LD.DESCRLOCAL
            ORDER BY TOTAL_TRANSFERENCIAS DESC
        `;

        const result = await conn.execute(query, {}, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });

        console.log('Análise por local encontrada:', result.rows.length);
        res.json(result.rows);

    } catch (err) {
        console.error('Erro ao buscar análise por local:', err);
        res.json([]);
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {
                console.error('Erro ao fechar conexão:', e);
            }
        }
    }
}

module.exports = {
    index,
    buscarTransferenciasPendentes,
    buscarTransferenciasFinalizadas,
    buscarAnalisePorPeriodo,
    buscarAnalisePorProduto,
    buscarAnalisePorLocal
};
