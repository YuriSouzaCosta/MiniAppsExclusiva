const db = require('../../config/db/oracle');
const oracledb = require('oracledb');
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;

// ========== VIEW ROUTES ==========

async function index(req, res) {
    console.log('=== ANALISE TRANSFERENCIAS INDEX - Rota acessada ===');
    res.render('analise-transferencias/index', { user: req.user });
}

function listaNumerica(raw) {
    if (!raw) return [];
    return (Array.isArray(raw) ? raw : String(raw).split(','))
        .map(x => String(x).trim()).filter(x => /^\d+$/.test(x)).map(Number);
}
function dataValida(raw, padrao) {
    return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : padrao;
}
function clausulaIn(lista, campo, prefixo, binds) {
    if (!lista.length) return '';
    return ` AND ${campo} IN (${lista.map((valor, i) => {
        const chave = `${prefixo}${i}`; binds[chave] = valor; return `:${chave}`;
    }).join(',')})`;
}

function grupoEmpresaSql(campo) {
    return `CASE
        WHEN ${campo} IN (1, 3) THEN 'EXCLUSIVA'
        WHEN ${campo} IN (2, 4, 7) THEN 'PRIME'
        WHEN ${campo} = 5 THEN 'SITE'
        WHEN ${campo} = 6 THEN 'DECORA'
        ELSE NULL
    END`;
}

// Dashboard baseado diretamente nas notas/itens do Sankhya. Nao usa a view
// antiga, cujo JOIN de local apenas por CODLOCAL pode multiplicar os itens.
async function dashboard(req, res) {
    try {
        const hoje = new Date(), iso = d => d.toISOString().slice(0, 10);
        const dtIni = dataValida(req.query.dt_ini, `${hoje.getFullYear()}-01-01`);
        const dtFin = dataValida(req.query.dt_fin, iso(hoje));
        const origens = listaNumerica(req.query.origem), destinos = listaNumerica(req.query.destino);
        const produtos = listaNumerica(req.query.codprod);
        const binds = { dtIni, dtFin };
        let filtro = '';
        filtro += clausulaIn(origens, 'C.CODEMP', 'ori', binds);
        filtro += clausulaIn(destinos, 'C.CODEMPNEGOC', 'des', binds);
        filtro += clausulaIn(produtos, 'I.CODPROD', 'pro', binds);
        const base = `WITH MOV AS (
          SELECT C.NUNOTA,TRUNC(C.DTNEG) DTNEG,C.CODTIPOPER,I.SEQUENCIA,C.CODEMP ORIGEM,C.CODEMPNEGOC DESTINO,
                 I.CODPROD,NVL(P.DESCRPROD,'Produto '||I.CODPROD) DESCRPROD,P.REFERENCIA,
                 NVL(I.QTDNEG,0) QTDNEG,
                 NVL(I.CUSTO,0) CUSTO_UNITARIO,
                 NVL(I.CUSTO,0)*NVL(I.QTDNEG,0) VALOR_CUSTO
            FROM TGFCAB C JOIN TGFITE I ON I.NUNOTA=C.NUNOTA
            LEFT JOIN TGFPRO P ON P.CODPROD=I.CODPROD
           WHERE C.CODTIPOPER IN (7000, 7001)
             AND I.SEQUENCIA > 0
             AND C.CODEMPNEGOC IS NOT NULL
             AND ${grupoEmpresaSql('C.CODEMP')} <> ${grupoEmpresaSql('C.CODEMPNEGOC')}
             AND TRUNC(C.DTNEG) BETWEEN TO_DATE(:dtIni,'YYYY-MM-DD') AND TO_DATE(:dtFin,'YYYY-MM-DD')
             ${filtro}
        ), EMP AS (
          SELECT CODEMP,NVL(NOMEFANTASIA,RAZAOSOCIAL) NOME FROM TSIEMP
        )`;
        const optionBinds = { dtIni, dtFin };
        const optionsBase = `WITH MOV AS (
          SELECT C.CODEMP ORIGEM,C.CODEMPNEGOC DESTINO,I.CODPROD,NVL(P.DESCRPROD,'Produto '||I.CODPROD) DESCRPROD
            FROM TGFCAB C JOIN TGFITE I ON I.NUNOTA=C.NUNOTA LEFT JOIN TGFPRO P ON P.CODPROD=I.CODPROD
           WHERE C.CODTIPOPER IN (7000, 7001) AND C.CODEMPNEGOC IS NOT NULL
             AND I.SEQUENCIA > 0
             AND ${grupoEmpresaSql('C.CODEMP')} <> ${grupoEmpresaSql('C.CODEMPNEGOC')}
             AND TRUNC(C.DTNEG) BETWEEN TO_DATE(:dtIni,'YYYY-MM-DD') AND TO_DATE(:dtFin,'YYYY-MM-DD')
        )`;
        const [totalR, fluxoR, mensalR, itensR, detalhesR, opcoesR] = await Promise.all([
            db.simpleExecute(`${base} SELECT COUNT(DISTINCT NUNOTA) TRANSFERENCIAS,NVL(SUM(QTDNEG),0) ITENS,
              NVL(SUM(VALOR_CUSTO),0) VALOR_CUSTO,
              COUNT(DISTINCT CODPROD) PRODUTOS,COUNT(DISTINCT ORIGEM||'>'||DESTINO) ROTAS FROM MOV`, binds),
            db.simpleExecute(`${base} SELECT M.ORIGEM,EO.NOME NOME_ORIGEM,M.DESTINO,ED.NOME NOME_DESTINO,
              COUNT(DISTINCT M.NUNOTA) TRANSFERENCIAS,SUM(M.QTDNEG) ITENS,SUM(M.VALOR_CUSTO) VALOR_CUSTO
              FROM MOV M LEFT JOIN EMP EO ON EO.CODEMP=M.ORIGEM LEFT JOIN EMP ED ON ED.CODEMP=M.DESTINO
              GROUP BY M.ORIGEM,EO.NOME,M.DESTINO,ED.NOME ORDER BY ITENS DESC`, binds),
            db.simpleExecute(`${base} SELECT TO_CHAR(DTNEG,'YYYY-MM') MES,ORIGEM,DESTINO,SUM(QTDNEG) ITENS,
              SUM(VALOR_CUSTO) VALOR_CUSTO,
              COUNT(DISTINCT NUNOTA) TRANSFERENCIAS FROM MOV GROUP BY TO_CHAR(DTNEG,'YYYY-MM'),ORIGEM,DESTINO ORDER BY MES`, binds),
            db.simpleExecute(`${base} SELECT CODPROD,DESCRPROD,REFERENCIA,ORIGEM,DESTINO,SUM(QTDNEG) ITENS,
              SUM(VALOR_CUSTO) VALOR_CUSTO,
              COUNT(DISTINCT NUNOTA) TRANSFERENCIAS FROM MOV
              GROUP BY CODPROD,DESCRPROD,REFERENCIA,ORIGEM,DESTINO ORDER BY ITENS DESC`, binds),
            db.simpleExecute(`${base} SELECT M.NUNOTA,TO_CHAR(M.DTNEG,'YYYY-MM-DD') DATA,M.CODTIPOPER,M.SEQUENCIA,
              M.ORIGEM,EO.NOME NOME_ORIGEM,M.DESTINO,ED.NOME NOME_DESTINO,
              M.CODPROD,M.DESCRPROD,M.REFERENCIA,M.QTDNEG,M.CUSTO_UNITARIO,M.VALOR_CUSTO
              FROM MOV M LEFT JOIN EMP EO ON EO.CODEMP=M.ORIGEM LEFT JOIN EMP ED ON ED.CODEMP=M.DESTINO
              ORDER BY M.DTNEG DESC,M.NUNOTA DESC,M.SEQUENCIA`, binds),
            db.simpleExecute(`${optionsBase} SELECT DISTINCT M.ORIGEM,NVL(EO.NOMEFANTASIA,EO.RAZAOSOCIAL) NOME_ORIGEM,
              M.DESTINO,NVL(ED.NOMEFANTASIA,ED.RAZAOSOCIAL) NOME_DESTINO,
              M.CODPROD,M.DESCRPROD FROM MOV M LEFT JOIN TSIEMP EO ON EO.CODEMP=M.ORIGEM
              LEFT JOIN TSIEMP ED ON ED.CODEMP=M.DESTINO ORDER BY NOME_ORIGEM,NOME_DESTINO,DESCRPROD`, optionBinds)
        ]);
        const t = (totalR.rows && totalR.rows[0]) || {};
        res.json({
            periodo: { dt_ini: dtIni, dt_fin: dtFin },
            totais: { transferencias:Number(t.TRANSFERENCIAS)||0,itens:Number(t.ITENS)||0,valor_custo:r2(t.VALOR_CUSTO),produtos:Number(t.PRODUTOS)||0,rotas:Number(t.ROTAS)||0 },
            fluxos: (fluxoR.rows||[]).map(x=>({origem:Number(x.ORIGEM),nome_origem:x.NOME_ORIGEM,destino:Number(x.DESTINO),nome_destino:x.NOME_DESTINO,transferencias:Number(x.TRANSFERENCIAS)||0,itens:Number(x.ITENS)||0,valor_custo:r2(x.VALOR_CUSTO)})),
            mensal: (mensalR.rows||[]).map(x=>({mes:x.MES,origem:Number(x.ORIGEM),destino:Number(x.DESTINO),itens:Number(x.ITENS)||0,valor_custo:r2(x.VALOR_CUSTO),transferencias:Number(x.TRANSFERENCIAS)||0})),
            itens: (itensR.rows||[]).map(x=>({codprod:Number(x.CODPROD),descrprod:x.DESCRPROD,referencia:x.REFERENCIA,origem:Number(x.ORIGEM),destino:Number(x.DESTINO),itens:Number(x.ITENS)||0,valor_custo:r2(x.VALOR_CUSTO),transferencias:Number(x.TRANSFERENCIAS)||0})),
            detalhes: (detalhesR.rows||[]).map(x=>({nunota:Number(x.NUNOTA),data:x.DATA,top:Number(x.CODTIPOPER),sequencia:Number(x.SEQUENCIA),origem:Number(x.ORIGEM),nome_origem:x.NOME_ORIGEM,destino:Number(x.DESTINO),nome_destino:x.NOME_DESTINO,codprod:Number(x.CODPROD),descrprod:x.DESCRPROD,referencia:x.REFERENCIA,qtd:Number(x.QTDNEG)||0,custo_unitario:r2(x.CUSTO_UNITARIO),valor_custo:r2(x.VALOR_CUSTO)})),
            opcoes: (opcoesR.rows||[]).map(x=>({origem:Number(x.ORIGEM),nome_origem:x.NOME_ORIGEM,destino:Number(x.DESTINO),nome_destino:x.NOME_DESTINO,codprod:Number(x.CODPROD),descrprod:x.DESCRPROD}))
        });
    } catch (err) {
        console.error('Erro no dashboard de transferencias:', err);
        res.status(500).json({ erro: String(err.message || err) });
    }
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
    buscarAnalisePorLocal,
    dashboard
};
