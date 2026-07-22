const db = require('../../config/db/oracle');
const oracledb = require('oracledb');

// Grupo requisitado = de onde a mercadoria SAI, na ordem de prioridade.
// EXCLUSIVA tenta o Showroom (1) e cai para o Dep. Araguaia (3); PRIME
// tenta a 4 e cai para a 2; SITE tenta a 5 e cai para a 7.
const GRUPOS = {
    EXCLUSIVA: [1, 3],
    PRIME: [4, 2],
    SITE: [5, 7]
};

const LOCAL_SHOWROOM = 110000;
const ROLES_SEPARACAO = ['ESTOQUISTA', 'ADMIN', 'GERENTE'];

function podeSeparar(user) {
    return !!user && ROLES_SEPARACAO.includes(user.role);
}

function qtdAtendida(item) {
    if (item.STATUS === 'PARCIAL') return Number(item.QTD_PARCIAL) || 0;
    if (item.STATUS === 'TEM') return Number(item.QTD) || 0;
    return 0;
}

// Empresa do usuario no Sankhya - sugestao de destino, alteravel na tela.
async function empresaDoUsuario(conn, username) {
    const result = await conn.execute(
        `SELECT CODEMP FROM TSIUSU WHERE NOMEUSU = :nome`,
        { nome: (username || '').toUpperCase() },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows.length ? result.rows[0].CODEMP : null;
}

// ========== VIEW ROUTES ==========

async function index(req, res) {
    let conn;
    try {
        conn = await db.getConnection();
        const codemp = await empresaDoUsuario(conn, req.user.username);
        res.render('requisicoes/index', {
            user: req.user,
            codempSugerido: codemp,
            podeSeparar: podeSeparar(req.user)
        });
    } catch (err) {
        console.error('Erro ao abrir requisicoes:', err);
        res.status(500).send('Erro ao abrir a tela de requisições');
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

async function nova(req, res) {
    let conn;
    try {
        conn = await db.getConnection();
        const codemp = await empresaDoUsuario(conn, req.user.username);

        const empresas = await conn.execute(
            `SELECT CODEMP, NOMEFANTASIA FROM TSIEMP WHERE CODEMP IN (1,2,3,4,5,6,7) ORDER BY CODEMP`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.render('requisicoes/nova', {
            user: req.user,
            codempSugerido: codemp,
            empresas: empresas.rows,
            grupos: Object.keys(GRUPOS)
        });
    } catch (err) {
        console.error('Erro ao abrir nova requisicao:', err);
        res.status(500).send('Erro ao abrir a tela de nova requisição');
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

async function separacao(req, res) {
    if (!podeSeparar(req.user)) {
        return res.status(403).render('requisicoes/sem-acesso', { user: req.user });
    }
    res.render('requisicoes/separacao', { user: req.user });
}

async function detalhe(req, res) {
    res.render('requisicoes/detalhe', {
        user: req.user,
        numReq: req.params.num,
        podeSeparar: podeSeparar(req.user)
    });
}

// ========== API ==========

// Busca de produto: descricao, referencia, referencia do fornecedor,
// codigo Sankhya e codigo de barras (este ultimo via TGFBAR, que a
// VW_CONSULTA_SITE_YSC nao expoe). Somente itens ativos.
async function buscarProdutos(req, res) {
    const { term, grupo } = req.query;
    if (!term || term.trim().length < 2) {
        return res.json([]);
    }

    let conn;
    try {
        conn = await db.getConnection();

        const termo = term.trim().toUpperCase();
        const like = '%' + termo.replace(/\s+/g, '%') + '%';
        const empresas = GRUPOS[grupo] || [];

        // "like" e palavra reservada no Oracle e nao pode nomear bind (ORA-01745)
        const binds = { termoLike: like, termoExato: termo };
        let colEstoque = '0 AS ESTOQUE_GRUPO';
        // sem grupo nao ha saldo para ordenar; com grupo, quem tem estoque vem primeiro
        let ordem = 'V.DESCRPROD';

        if (empresas.length) {
            const listaEmp = empresas.map((emp, i) => {
                binds['emp' + i] = emp;
                return ':emp' + i;
            }).join(',');
            colEstoque = `(SELECT NVL(SUM(E.ESTOQUE), 0)
                             FROM VW_MIRROR_EST_YSC E
                            WHERE E.CODPROD = V.CODPROD
                              AND E.CODEMP IN (${listaEmp})) AS ESTOQUE_GRUPO`;
            ordem = 'ESTOQUE_GRUPO DESC, V.DESCRPROD';
        }

        const result = await conn.execute(
            `SELECT * FROM (
                SELECT DISTINCT
                       V.CODPROD,
                       V.DESCRPROD,
                       V.REFERENCIA,
                       V.REFFORN,
                       V.MARCA,
                       ${colEstoque}
                  FROM VW_CONSULTA_SITE_YSC V
                 WHERE V.ATIVO = 'S'
                   AND (
                        UPPER(V.DESCRPROD) LIKE :termoLike
                     OR UPPER(TO_CHAR(V.REFERENCIA)) LIKE :termoLike
                     OR UPPER(TO_CHAR(V.REFFORN)) LIKE :termoLike
                     OR TO_CHAR(V.CODPROD) = :termoExato
                     OR EXISTS (SELECT 1 FROM TGFBAR B
                                 WHERE B.CODPROD = V.CODPROD
                                   AND TRIM(B.CODBARRA) = :termoExato)
                   )
                 ORDER BY ${ordem}
             ) WHERE ROWNUM <= 50`,
            binds,
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

async function criarRequisicao(req, res) {
    const { grupo, codempDestino, prioridade, observacao, itens } = req.body;

    if (!GRUPOS[grupo]) {
        return res.status(400).json({ error: 'Grupo requisitado inválido' });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: 'Informe ao menos um produto' });
    }
    if (GRUPOS[grupo].includes(Number(codempDestino))) {
        return res.status(400).json({
            error: 'A empresa de destino faz parte do grupo requisitado — escolha outro destino'
        });
    }

    let conn;
    try {
        conn = await db.getConnection();

        const seq = await conn.execute(
            `SELECT JIVA.AD_REQ_CAB_SEQ.NEXTVAL AS N FROM DUAL`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const numReq = seq.rows[0].N;

        await conn.execute(
            `INSERT INTO JIVA.AD_REQ_CAB_YSC
                (NUM_REQ, DATA_INICIO, REQUISITANTE, GRUPO_REQUISITADO,
                 CODEMP_DESTINO, STATUS, PRIORIDADE, OBSERVACAO)
             VALUES
                (:numReq, SYSDATE, :requisitante, :grupo,
                 :codempDestino, 'ABERTA', :prioridade, :observacao)`,
            {
                numReq,
                requisitante: req.user.username,
                grupo,
                codempDestino: Number(codempDestino),
                prioridade: prioridade === 'URGENTE' ? 'URGENTE' : 'NORMAL',
                observacao: observacao || null
            }
        );

        let sequencia = 0;
        for (const item of itens) {
            sequencia += 1;
            await conn.execute(
                `INSERT INTO JIVA.AD_REQ_ITE_YSC
                    (NUM_REQ, SEQUENCIA, COD_SNK, QTD, OBSERVACAO)
                 VALUES (:numReq, :sequencia, :codSnk, :qtd, :obs)`,
                {
                    numReq,
                    sequencia,
                    codSnk: Number(item.codprod),
                    qtd: Number(item.qtd),
                    obs: item.observacao || null
                }
            );
        }

        await conn.commit();
        console.log('Requisicao criada:', numReq, 'itens:', sequencia);
        res.json({ success: true, numReq, itens: sequencia });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch (e) { console.error(e); } }
        console.error('Erro ao criar requisicao:', err);
        res.status(500).json({ error: 'Erro ao criar requisição', details: err.message });
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

async function listarRequisicoes(req, res) {
    const { status, escopo } = req.query;
    let conn;
    try {
        conn = await db.getConnection();

        const binds = {};
        let filtro = '';

        // escopo "fila" = tela de separacao; "minhas" = do proprio requisitante
        if (escopo === 'fila') {
            if (!podeSeparar(req.user)) {
                return res.status(403).json({ error: 'Sem permissão para a fila de separação' });
            }
        } else {
            filtro += ' AND C.REQUISITANTE = :requisitante';
            binds.requisitante = req.user.username;
        }

        if (status) {
            filtro += ' AND C.STATUS = :status';
            binds.status = status;
        }

        const result = await conn.execute(
            `SELECT C.NUM_REQ,
                    TO_CHAR(C.DATA_INICIO, 'DD/MM/YYYY HH24:MI')      AS DATA_INICIO,
                    TO_CHAR(C.DATA_SEPARACAO, 'DD/MM/YYYY HH24:MI')   AS DATA_SEPARACAO,
                    TO_CHAR(C.DATA_CONCLUSAO, 'DD/MM/YYYY HH24:MI')   AS DATA_CONCLUSAO,
                    TO_CHAR(C.DATA_RECEBIMENTO, 'DD/MM/YYYY HH24:MI') AS DATA_RECEBIMENTO,
                    C.REQUISITANTE, C.GRUPO_REQUISITADO, C.SEPARADOR, C.RECEBEDOR,
                    C.CODEMP_DESTINO, C.STATUS, C.PRIORIDADE, C.OBSERVACAO,
                    E.NOMEFANTASIA AS EMPRESA_DESTINO,
                    (SELECT COUNT(*) FROM JIVA.AD_REQ_ITE_YSC I
                      WHERE I.NUM_REQ = C.NUM_REQ) AS TOTAL_ITENS,
                    (SELECT COUNT(*) FROM JIVA.AD_REQ_ITE_YSC I
                      WHERE I.NUM_REQ = C.NUM_REQ AND I.STATUS IS NOT NULL) AS ITENS_SEPARADOS
               FROM JIVA.AD_REQ_CAB_YSC C
               LEFT JOIN TSIEMP E ON E.CODEMP = C.CODEMP_DESTINO
              WHERE 1 = 1 ${filtro}
              ORDER BY CASE C.PRIORIDADE WHEN 'URGENTE' THEN 0 ELSE 1 END,
                       C.DATA_INICIO`,
            binds,
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar requisicoes:', err);
        res.status(500).json({ error: 'Erro ao listar requisições' });
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

async function obterRequisicao(req, res) {
    const numReq = Number(req.params.num);
    let conn;
    try {
        conn = await db.getConnection();

        const cab = await conn.execute(
            `SELECT C.NUM_REQ,
                    TO_CHAR(C.DATA_INICIO, 'DD/MM/YYYY HH24:MI')      AS DATA_INICIO,
                    TO_CHAR(C.DATA_SEPARACAO, 'DD/MM/YYYY HH24:MI')   AS DATA_SEPARACAO,
                    TO_CHAR(C.DATA_CONCLUSAO, 'DD/MM/YYYY HH24:MI')   AS DATA_CONCLUSAO,
                    TO_CHAR(C.DATA_RECEBIMENTO, 'DD/MM/YYYY HH24:MI') AS DATA_RECEBIMENTO,
                    C.REQUISITANTE, C.GRUPO_REQUISITADO, C.SEPARADOR, C.RECEBEDOR,
                    C.CODEMP_DESTINO, C.STATUS, C.PRIORIDADE, C.OBSERVACAO,
                    E.NOMEFANTASIA AS EMPRESA_DESTINO
               FROM JIVA.AD_REQ_CAB_YSC C
               LEFT JOIN TSIEMP E ON E.CODEMP = C.CODEMP_DESTINO
              WHERE C.NUM_REQ = :numReq`,
            { numReq },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (!cab.rows.length) {
            return res.status(404).json({ error: 'Requisição não encontrada' });
        }

        const grupo = cab.rows[0].GRUPO_REQUISITADO;
        const empresas = GRUPOS[grupo] || [];
        const binds = { numReq };
        let colEstoque = '0 AS ESTOQUE_GRUPO';

        if (empresas.length) {
            const listaEmp = empresas.map((emp, i) => {
                binds['emp' + i] = emp;
                return ':emp' + i;
            }).join(',');
            colEstoque = `(SELECT NVL(SUM(E.ESTOQUE), 0)
                             FROM VW_MIRROR_EST_YSC E
                            WHERE E.CODPROD = I.COD_SNK
                              AND E.CODEMP IN (${listaEmp})) AS ESTOQUE_GRUPO`;
        }

        const itens = await conn.execute(
            `SELECT I.SEQUENCIA, I.COD_SNK, I.QTD, I.STATUS, I.QTD_PARCIAL,
                    I.CODEMP_ORIGEM, I.CODLOCAL_ORIGEM, I.NUNOTA, I.OBSERVACAO,
                    P.DESCRPROD, P.REFERENCIA, P.REFFORN,
                    ${colEstoque}
               FROM JIVA.AD_REQ_ITE_YSC I
               LEFT JOIN TGFPRO P ON P.CODPROD = I.COD_SNK
              WHERE I.NUM_REQ = :numReq
              ORDER BY I.SEQUENCIA`,
            binds,
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json({ cabecalho: cab.rows[0], itens: itens.rows });
    } catch (err) {
        console.error('Erro ao obter requisicao:', err);
        res.status(500).json({ error: 'Erro ao obter requisição' });
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

// Assume a separacao: primeira pessoa que abrir trava a requisicao no
// proprio nome, para duas nao separarem a mesma lista.
async function assumirSeparacao(req, res) {
    if (!podeSeparar(req.user)) {
        return res.status(403).json({ error: 'Sem permissão para separar' });
    }

    const numReq = Number(req.params.num);
    let conn;
    try {
        conn = await db.getConnection();

        const result = await conn.execute(
            `UPDATE JIVA.AD_REQ_CAB_YSC
                SET STATUS = 'EM_SEPARACAO',
                    SEPARADOR = :separador,
                    DATA_SEPARACAO = SYSDATE
              WHERE NUM_REQ = :numReq
                AND STATUS = 'ABERTA'`,
            { numReq, separador: req.user.username }
        );

        if (result.rowsAffected === 0) {
            const atual = await conn.execute(
                `SELECT STATUS, SEPARADOR FROM JIVA.AD_REQ_CAB_YSC WHERE NUM_REQ = :numReq`,
                { numReq },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            if (!atual.rows.length) {
                return res.status(404).json({ error: 'Requisição não encontrada' });
            }
            const row = atual.rows[0];
            if (row.STATUS === 'EM_SEPARACAO' && row.SEPARADOR === req.user.username) {
                return res.json({ success: true, jaEra: true });
            }
            return res.status(409).json({
                error: `Requisição já está ${row.STATUS}` + (row.SEPARADOR ? ` com ${row.SEPARADOR}` : '')
            });
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch (e) { console.error(e); } }
        console.error('Erro ao assumir separacao:', err);
        res.status(500).json({ error: 'Erro ao assumir a separação' });
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

async function salvarItens(req, res) {
    if (!podeSeparar(req.user)) {
        return res.status(403).json({ error: 'Sem permissão para separar' });
    }

    const numReq = Number(req.params.num);
    const { itens } = req.body;

    if (!Array.isArray(itens)) {
        return res.status(400).json({ error: 'Lista de itens inválida' });
    }

    let conn;
    try {
        conn = await db.getConnection();

        const cab = await conn.execute(
            `SELECT STATUS FROM JIVA.AD_REQ_CAB_YSC WHERE NUM_REQ = :numReq`,
            { numReq },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (!cab.rows.length) {
            return res.status(404).json({ error: 'Requisição não encontrada' });
        }
        if (cab.rows[0].STATUS !== 'EM_SEPARACAO') {
            return res.status(409).json({
                error: `Requisição está ${cab.rows[0].STATUS} — não é possível alterar os itens`
            });
        }

        for (const item of itens) {
            const status = item.status || null;
            const parcial = status === 'PARCIAL' ? Number(item.qtdParcial) || 0 : null;

            if (status === 'PARCIAL' && parcial <= 0) {
                return res.status(400).json({
                    error: `Item ${item.sequencia}: informe a quantidade parcial`
                });
            }

            await conn.execute(
                `UPDATE JIVA.AD_REQ_ITE_YSC
                    SET STATUS = :status, QTD_PARCIAL = :parcial
                  WHERE NUM_REQ = :numReq AND SEQUENCIA = :sequencia`,
                { status, parcial, numReq, sequencia: Number(item.sequencia) }
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch (e) { console.error(e); } }
        console.error('Erro ao salvar itens:', err);
        res.status(500).json({ error: 'Erro ao salvar os itens', details: err.message });
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

// Decide de qual empresa e local sai cada item, seguindo a prioridade do
// grupo. O item vai inteiro para uma empresa so; se nenhuma das duas tiver
// saldo completo, fica com a prioritaria e o item entra em "avisos".
async function ratearItens(conn, grupo, itens) {
    const empresas = GRUPOS[grupo];
    const alocacoes = [];
    const avisos = [];

    for (const item of itens) {
        const qtd = qtdAtendida(item);
        if (qtd <= 0) continue;

        const estoque = await conn.execute(
            `SELECT CODEMP, CODLOCAL, ESTOQUE
               FROM VW_MIRROR_EST_YSC
              WHERE CODPROD = :codProd
                AND ESTOQUE > 0
                AND CODEMP IN (:emp0, :emp1)`,
            { codProd: item.COD_SNK, emp0: empresas[0], emp1: empresas[1] },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        let escolhida = null;

        for (const emp of empresas) {
            const locais = estoque.rows.filter(r => Number(r.CODEMP) === emp);
            const total = locais.reduce((soma, r) => soma + Number(r.ESTOQUE), 0);
            if (total >= qtd) {
                escolhida = { codemp: emp, locais };
                break;
            }
        }

        if (!escolhida) {
            escolhida = {
                codemp: empresas[0],
                locais: estoque.rows.filter(r => Number(r.CODEMP) === empresas[0])
            };
            avisos.push(
                `Item ${item.SEQUENCIA} (${item.COD_SNK} - ${item.DESCRPROD || 's/ descrição'}): ` +
                `nenhuma empresa do grupo ${grupo} tem os ${qtd} necessários. ` +
                `Transferência gerada pela empresa ${empresas[0]} — conferir saldo.`
            );
        }

        // Local: prioriza o Showroom, depois o de maior saldo que cubra a quantidade.
        const ordenados = escolhida.locais.slice().sort((a, b) => {
            const showroomA = Number(a.CODLOCAL) === LOCAL_SHOWROOM ? 0 : 1;
            const showroomB = Number(b.CODLOCAL) === LOCAL_SHOWROOM ? 0 : 1;
            if (showroomA !== showroomB) return showroomA - showroomB;
            return Number(b.ESTOQUE) - Number(a.ESTOQUE);
        });

        const local = ordenados.find(r => Number(r.ESTOQUE) >= qtd) || ordenados[0];

        alocacoes.push({
            sequencia: item.SEQUENCIA,
            codemp: escolhida.codemp,
            codlocal: local ? Number(local.CODLOCAL) : LOCAL_SHOWROOM,
            qtd
        });
    }

    return { alocacoes, avisos };
}

// Libera a requisicao: rateia, gera uma transferencia por empresa de
// origem e fecha o cabecalho. Tudo numa transacao so.
async function liberarRequisicao(req, res) {
    if (!podeSeparar(req.user)) {
        return res.status(403).json({ error: 'Sem permissão para liberar' });
    }

    const numReq = Number(req.params.num);
    let conn;
    try {
        conn = await db.getConnection();

        const cab = await conn.execute(
            `SELECT STATUS, GRUPO_REQUISITADO, CODEMP_DESTINO
               FROM JIVA.AD_REQ_CAB_YSC WHERE NUM_REQ = :numReq`,
            { numReq },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (!cab.rows.length) {
            return res.status(404).json({ error: 'Requisição não encontrada' });
        }
        if (cab.rows[0].STATUS !== 'EM_SEPARACAO') {
            return res.status(409).json({
                error: `Requisição está ${cab.rows[0].STATUS} — só é possível liberar uma separação em andamento`
            });
        }

        const itens = await conn.execute(
            `SELECT I.SEQUENCIA, I.COD_SNK, I.QTD, I.STATUS, I.QTD_PARCIAL, P.DESCRPROD
               FROM JIVA.AD_REQ_ITE_YSC I
               LEFT JOIN TGFPRO P ON P.CODPROD = I.COD_SNK
              WHERE I.NUM_REQ = :numReq
              ORDER BY I.SEQUENCIA`,
            { numReq },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const pendentes = itens.rows.filter(i => !i.STATUS);
        if (pendentes.length) {
            return res.status(400).json({
                error: `Ainda há ${pendentes.length} item(ns) sem marcação`,
                pendentes: pendentes.map(i => i.SEQUENCIA)
            });
        }

        const grupo = cab.rows[0].GRUPO_REQUISITADO;
        const { alocacoes, avisos } = await ratearItens(conn, grupo, itens.rows);

        for (const alocacao of alocacoes) {
            await conn.execute(
                `UPDATE JIVA.AD_REQ_ITE_YSC
                    SET CODEMP_ORIGEM = :codemp, CODLOCAL_ORIGEM = :codlocal
                  WHERE NUM_REQ = :numReq AND SEQUENCIA = :sequencia`,
                {
                    codemp: alocacao.codemp,
                    codlocal: alocacao.codlocal,
                    numReq,
                    sequencia: alocacao.sequencia
                }
            );
        }

        // Uma transferencia por empresa de origem.
        const empresasOrigem = [...new Set(alocacoes.map(a => a.codemp))];
        const notas = [];

        for (const codemp of empresasOrigem) {
            const saida = await conn.execute(
                `BEGIN
                    JIVA.STP_TRANSF_REQUISICAO_YSC(
                        P_NUM_REQ       => :numReq,
                        P_CODEMP_ORIGEM => :codemp,
                        P_NUNOTA        => :nunota,
                        P_MENSAGEM      => :mensagem
                    );
                 END;`,
                {
                    numReq,
                    codemp,
                    nunota: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                    mensagem: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
                }
            );

            notas.push({
                codemp,
                nunota: saida.outBinds.nunota,
                mensagem: saida.outBinds.mensagem
            });
        }

        await conn.execute(
            `UPDATE JIVA.AD_REQ_CAB_YSC
                SET STATUS = 'FINALIZADA', DATA_CONCLUSAO = SYSDATE
              WHERE NUM_REQ = :numReq`,
            { numReq }
        );

        await conn.commit();
        console.log('Requisicao liberada:', numReq, 'notas:', JSON.stringify(notas));

        res.json({
            success: true,
            numReq,
            notas,
            avisos,
            semAtendimento: itens.rows.filter(i => qtdAtendida(i) <= 0).length
        });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch (e) { console.error(e); } }
        console.error('Erro ao liberar requisicao:', err);
        res.status(500).json({ error: 'Erro ao liberar a requisição', details: err.message });
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

async function confirmarRecebimento(req, res) {
    const numReq = Number(req.params.num);
    let conn;
    try {
        conn = await db.getConnection();

        const result = await conn.execute(
            `UPDATE JIVA.AD_REQ_CAB_YSC
                SET STATUS = 'RECEBIDA', RECEBEDOR = :recebedor, DATA_RECEBIMENTO = SYSDATE
              WHERE NUM_REQ = :numReq
                AND STATUS = 'FINALIZADA'`,
            { numReq, recebedor: req.user.username }
        );

        if (result.rowsAffected === 0) {
            return res.status(409).json({ error: 'Só é possível receber uma requisição finalizada' });
        }

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch (e) { console.error(e); } }
        console.error('Erro ao confirmar recebimento:', err);
        res.status(500).json({ error: 'Erro ao confirmar o recebimento' });
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

async function cancelarRequisicao(req, res) {
    const numReq = Number(req.params.num);
    let conn;
    try {
        conn = await db.getConnection();

        const cab = await conn.execute(
            `SELECT REQUISITANTE, STATUS FROM JIVA.AD_REQ_CAB_YSC WHERE NUM_REQ = :numReq`,
            { numReq },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (!cab.rows.length) {
            return res.status(404).json({ error: 'Requisição não encontrada' });
        }

        const dono = cab.rows[0].REQUISITANTE === req.user.username;
        if (!dono && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Só o requisitante ou um admin pode cancelar' });
        }
        if (cab.rows[0].STATUS !== 'ABERTA') {
            return res.status(409).json({
                error: `Requisição está ${cab.rows[0].STATUS} — só dá para cancelar enquanto ABERTA`
            });
        }

        await conn.execute(
            `UPDATE JIVA.AD_REQ_CAB_YSC SET STATUS = 'CANCELADA' WHERE NUM_REQ = :numReq`,
            { numReq }
        );

        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch (e) { console.error(e); } }
        console.error('Erro ao cancelar requisicao:', err);
        res.status(500).json({ error: 'Erro ao cancelar a requisição' });
    } finally {
        if (conn) { try { await conn.close(); } catch (e) { console.error(e); } }
    }
}

module.exports = {
    index,
    nova,
    separacao,
    detalhe,
    buscarProdutos,
    criarRequisicao,
    listarRequisicoes,
    obterRequisicao,
    assumirSeparacao,
    salvarItens,
    liberarRequisicao,
    confirmarRecebimento,
    cancelarRequisicao
};
