const db = require('../../config/db/oracle');
const oracledb = require('oracledb');

// ========== VIEW ROUTES ==========

async function index(req, res) {
    console.log('=== PEDIDO COMPRAS INDEX - Rota acessada ===');
    res.render('pedidos/pedidoCompras', { user: req.user });
}

async function listaPedidos(req, res) {
    console.log('=== LISTA PEDIDOS - Rota acessada ===');
    res.render('pedidos/listaPedidos', { user: req.user });
}

async function fazerPedidos(req, res) {
    console.log('=== FAZER PEDIDOS - Rota acessada ===');
    res.render('pedidos/fazerPedidos', { user: req.user });
}

async function finalizarPedidos(req, res) {
    console.log('=== FINALIZAR PEDIDOS - Rota acessada ===');
    res.render('pedidos/finalizarPedidos', { user: req.user });
}

async function pedidosFinalizados(req, res) {
    console.log('=== PEDIDOS FINALIZADOS - Rota acessada ===');
    res.render('pedidos/pedidoFinalizados', { user: req.user });
}

// ========== API ENDPOINTS ==========

// Load brands
async function carregarMarcas(req, res) {
    console.log('=== CARREGAR MARCAS - API chamada ===');
    let conn;
    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            'SELECT DESCRICAO FROM tgfmar ORDER BY DESCRICAO ASC',
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Marcas encontradas:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar marcas:', err);
        res.status(500).json({ error: 'Erro ao buscar marcas' });
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

// Load suppliers
async function carregarFornecedores(req, res) {
    console.log('=== CARREGAR FORNECEDORES - API chamada ===');
    let conn;
    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            `SELECT CODPARC, CGC_CPF, RAZAOSOCIAL, NOMEPARC 
             FROM TGFPAR 
             WHERE FORNECEDOR = 'S' 
             ORDER BY RAZAOSOCIAL ASC`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Fornecedores encontrados:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar fornecedores:', err);
        res.status(500).json({ error: 'Erro ao buscar fornecedores' });
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

// Load payment methods
async function carregarFormaPagamentos(req, res) {
    console.log('=== CARREGAR FORMAS PAGAMENTO - API chamada ===');
    let conn;
    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            `SELECT distinct CODTIPVENDA, DESCRTIPVENDA 
             FROM TGFTPV 
             ORDER BY DESCRTIPVENDA ASC`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Formas de pagamento encontradas:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar formas de pagamento:', err);
        res.status(500).json({ error: 'Erro ao buscar formas de pagamento' });
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

// Create order
async function criarPedido(req, res) {
    console.log('=== CRIAR PEDIDO - API chamada ===');
    console.log('Body:', req.body);

    const { marca, dtInit, dtEnd, gpEmp } = req.body;
    let conn;
    let gp;
    if (gpEmp == 1) {
        gp = 'EXCLUSIVA';
        emp = '1,3';
    } if (gpEmp == 2) {
        gp = 'PRIME';
        emp = '2,4,7';
    } if (gpEmp == 3) {
        gp = 'SITE';
        emp = '5'
    }
    try {
        conn = await db.getConnection();

        // Insert into orders table (adjust table name and columns as needed)
        const result = await conn.execute(
            `INSERT INTO CABECALHO_PEDIDO_YSC 
             (MARCA, DATA_INICIAL, DATA_FINAL, GRUPO, DATA_PEDIDO, ANDAMENTO, EMPRESA) 
             VALUES (:marca, TO_DATE(:dtInit, 'YYYY-MM-DD'), TO_DATE(:dtEnd, 'YYYY-MM-DD'), :gp, TRUNC(SYSDATE), 'ABERTO', :emp) 
             RETURNING NUMERO_PEDIDO INTO :id`,
            {
                marca,
                dtInit,
                dtEnd,
                gp,
                emp,
                id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const pedidoId = result.outBinds.id[0];
        console.log('Pedido criado com ID:', pedidoId);

        res.json({ success: true, id: pedidoId });
    } catch (err) {
        console.error('Erro ao criar pedido:', err);
        res.status(500).json({ error: 'Erro ao criar pedido' });
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

// List orders
async function consultarPedidos(req, res) {
    console.log('=== CONSULTAR PEDIDOS - API chamada ===');
    let conn;
    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            `SELECT NUMERO_PEDIDO, MARCA, DATA_PEDIDO, DATA_INICIAL, DATA_FINAL, GRUPO, ANDAMENTO 
             FROM CABECALHO_PEDIDO_YSC 
             WHERE ANDAMENTO = 'ABERTO'
             ORDER BY DATA_PEDIDO DESC`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Pedidos encontrados:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao consultar pedidos:', err);
        res.status(500).json({ error: 'Erro ao consultar pedidos' });
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

// List completed orders (ready to finalize)
async function consultarPedidosFeitos(req, res) {
    console.log('=== CONSULTAR PEDIDOS FEITOS - API chamada ===');
    let conn;
    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            `SELECT NUMERO_PEDIDO, MARCA, DATA_PEDIDO, DATAFATURAMENTO, DATAENTREGA, 
                    GRUPO, ANDAMENTO, VLRTOTAL, CODEMP
             FROM CABECALHO_PEDIDO_YSC 
             WHERE ANDAMENTO = 'FEITO'
             ORDER BY DATA_PEDIDO DESC`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Pedidos feitos encontrados:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao consultar pedidos feitos:', err);
        res.status(500).json({ error: 'Erro ao consultar pedidos feitos' });
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

// List finalized orders
async function consultarPedidosCompleto(req, res) {
    console.log('=== CONSULTAR PEDIDOS COMPLETOS - API chamada ===');
    let conn;
    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            `SELECT NUMERO_PEDIDO, NUNOTA, PARCEIRO,GRUPO, MARCA, DATA_PEDIDO, DATAFATURAMENTO, 
                    DATAENTREGA, EMPRESA, ANDAMENTO, FORMA_PAGTO, VLRTOTAL 
             FROM CABECALHO_PEDIDO_YSC 
             WHERE ANDAMENTO = 'FINALIZADO'
             ORDER BY DATA_PEDIDO DESC`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Pedidos finalizados encontrados:', result.rows.length);
        if (result.rows.length > 0) {
            console.log('🔍 Exemplo do primeiro registro do banco:', result.rows[0]);
        }
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao consultar pedidos completos:', err);
        res.status(500).json({ error: 'Erro ao consultar pedidos completos' });
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

// Delete order
async function fecharPedido(req, res) {
    console.log('=== FECHAR PEDIDO - API chamada ===');
    const { id_pedido } = req.query;
    let conn;

    try {
        conn = await db.getConnection();
        await conn.execute(
            'DELETE FROM CABECALHO_PEDIDO_YSC WHERE NUMERO_PEDIDO = :id',
            { id: id_pedido },
            { autoCommit: true }
        );
        console.log('Pedido deletado:', id_pedido);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao deletar pedido:', err);
        res.status(500).json({ error: 'Erro ao deletar pedido' });
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

// Update order status to FEITO (completed)
async function atualizarPedidoFeito(req, res) {
    console.log('=== ATUALIZAR PEDIDO FEITO - API chamada ===');
    const { id, CodEmp, dataFaturamento, dataEntrega, valorTotal } = req.body;
    let conn;

    console.log('Dados recebidos:', { id, CodEmp, dataFaturamento, dataEntrega, valorTotal });

    try {
        conn = await db.getConnection();

        await conn.execute(
            `UPDATE CABECALHO_PEDIDO_YSC 
             SET ANDAMENTO = 'FEITO', 
                 CODEMP = :CodEmp, 
                 DATAENTREGA = TO_DATE(:dataEntrega, 'YYYY-MM-DD'), 
                 DATAFATURAMENTO = TO_DATE(:dataFaturamento, 'YYYY-MM-DD'), 
                 VLRTOTAL = :valorTotal
             WHERE NUMERO_PEDIDO = :id`,
            {
                CodEmp: Number(CodEmp),
                dataEntrega,
                dataFaturamento,
                valorTotal: Number(valorTotal),
                id: Number(id)
            },
            { autoCommit: true }
        );

        console.log('Pedido atualizado para FEITO:', id);
        res.json({ result: 'Pedido Finalizado com Sucesso', success: true });
    } catch (err) {
        console.error('Erro ao atualizar pedido:', err);
        res.status(500).json({
            error: 'Erro ao finalizar pedido',
            details: err.message,
            id,
            CodEmp
        });
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

// Finalize order
async function finalizarPedidoFinal(req, res) {
    console.log('=== FINALIZAR PEDIDO FINAL - API chamada ===');
    console.log('Body:', req.body);

    const { idPagamento, idFornecedor, cod_pagamento, cod_fornecedor, numero_pedido } = req.body;
    
    // Converter para Number para evitar erro de tipo no Oracle
    const numPedidoInt = Number(numero_pedido);
    const codPagInt = Number(cod_pagamento);
    const codFornInt = Number(cod_fornecedor);
    
    let conn;

    try {
        conn = await db.getConnection();

        // 1. Atualizar o pedido
        await conn.execute(
            `UPDATE CABECALHO_PEDIDO_YSC 
             SET FORMA_PAGTO = :formaPag,
                 PARCEIRO = :fornecedor,
                 COD_FORMA_PAGTO = :codPag,
                 COD_PARCEIRO = :codForn,
                 DATA_PEDIDO = TRUNC(DATA_PEDIDO),
                 ANDAMENTO = 'FINALIZADO'
             WHERE NUMERO_PEDIDO = :numPedido`,
            {
                formaPag: idPagamento,
                fornecedor: idFornecedor,
                codPag: codPagInt,
                codForn: codFornInt,
                numPedido: numPedidoInt
            },
            { autoCommit: false } // Não commitar ainda
        );

        // 2. Savepoint antes de chamar a procedure
        await conn.execute(`SAVEPOINT antes_procedure`);

        // 3. Chamar a procedure
        let mensagemProcedure = null;
        let tentativas = 0;
        const maxTentativas = 3;
        
        while (tentativas < maxTentativas) {
            tentativas++;
            try {
                console.log(`Tentativa ${tentativas}/${maxTentativas} para pedido ${numPedidoInt}`);
                
                const result = await conn.execute(
                    `BEGIN
                        JIVA.STP_GERARPEDCOMPRA_IMPORT_YSC(:P_NUM_PEDIDO, :P_MENSAGEM);
                    END;`,
                    {
                        P_NUM_PEDIDO: numPedidoInt,
                        P_MENSAGEM: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
                    },
                    { autoCommit: false }
                );
                mensagemProcedure = result.outBinds.P_MENSAGEM;
                console.log('Procedure executada com sucesso na tentativa', tentativas, '- Mensagem:', mensagemProcedure);
                break;
            } catch (procErr) {
                console.error(`Erro na tentativa ${tentativas}:`, procErr.message);
                if (procErr.message.includes('ORA-01422') && tentativas < maxTentativas) {
                    console.log(`ORA-01422 persistente. Rollback ao savepoint e aguardando...`);
                    try {
                        await conn.execute(`ROLLBACK TO SAVEPOINT antes_procedure`);
                    } catch (rbErr) {
                        console.error('Erro no rollback to savepoint:', rbErr.message);
                    }
                    const waitMs = Math.pow(2, tentativas) * 1000;
                    console.log(`Aguardando ${waitMs}ms antes da tentativa ${tentativas + 1}...`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    await conn.execute(`SAVEPOINT antes_procedure`);
                    continue;
                }
                throw procErr;
            }
        }

        console.log('Mensagem da procedure:', mensagemProcedure);

        // Se chegou até aqui, commit das alterações
        await conn.commit();

        console.log('Pedido finalizado:', numPedidoInt);
        res.json({
            success: true,
            result: "Pedido Finalizado com Sucesso",
            mensagemProcedure: mensagemProcedure
        });

    } catch (err) {
        // Rollback em caso de erro
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackErr) {
                console.error("Erro no rollback:", rollbackErr);
            }
        }

        console.error('Erro ao finalizar pedido:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao finalizar pedido',
            details: err.message
        });
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

// Load order details with items for analysis
async function loadPedidos(req, res) {
    console.log('=== LOAD PEDIDOS - API chamada ===');
    const { id_pedido } = req.query; // Using req.query for GET request
    let conn;

    if (!id_pedido) {
        return res.status(400).json({ error: 'ID do pedido é obrigatório' });
    }

    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            `SELECT * FROM PEDIDO_PROCESSADO_YSC 
             WHERE NUMERO_PEDIDO = :idPedido
             ORDER BY LINHA , DESCRPROD`,
            { idPedido: id_pedido },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Itens do pedido encontrados:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao carregar pedido:', err);
        res.status(500).json({ error: 'Erro ao carregar pedido' });
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

// Export to PDF (returns data for PDF generation)
async function exportarPdf(req, res) {
    console.log('=== EXPORTAR PDF - API chamada ===');
    const { numero_pedido } = req.query;
    let conn;

    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            `select CAB.NUMERO_PEDIDO, ITE.DESCRPROD, ITE.REFFORN , ITE.QTD_PEDIR, CAB.CODEMP, cab.marca from PEDIDO_PROCESSADO_YSC ITE 
INNER JOIN CABECALHO_PEDIDO_YSC CAB ON CAB.NUMERO_PEDIDO = ITE.NUMERO_PEDIDO 
    WHERE CAB.NUMERO_PEDIDO = :numPedido ORDER BY CODPROD`,
            { numPedido: numero_pedido },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Itens do pedido encontrados:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao exportar PDF:', err);
        res.status(500).json({ error: 'Erro ao exportar PDF' });
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

// Save/Update multiple pedidos
async function salvarPedidos(req, res) {
    console.log('=== SALVAR PEDIDOS - API chamada ===');
    let conn;
    try {
        // 1. Validação e normalização dos dados
        const pedidos = Array.isArray(req.body) ? req.body : [req.body];

        // 2. Conectar ao banco
        conn = await db.getConnection();

        // 3. Preparar binds com tipos explícitos
        const binds = pedidos.map(pedido => [
            Number(pedido.quantidade),
            Number(pedido.valorTotal),
            Number(pedido.id),
            Number(pedido.codProd)
        ]);

        // 4. Executar atualização com executeMany
        const result = await conn.executeMany(
            `UPDATE PEDIDO_PROCESSADO_YSC 
             SET QTD_PEDIR = :1, VLR_TOTAL = :2 
             WHERE NUMERO_PEDIDO = :3 AND CODPROD = :4`,
            binds,
            {
                autoCommit: true,
                bindDefs: [
                    { type: oracledb.NUMBER },
                    { type: oracledb.NUMBER },
                    { type: oracledb.NUMBER },
                    { type: oracledb.NUMBER }
                ]
            }
        );

        console.log(`${pedidos.length} pedidos atualizados, linhas afetadas:`, result.rowsAffected);

        res.json({
            success: true,
            message: `${pedidos.length} pedidos atualizados`,
            rowsAffected: result.rowsAffected
        });

    } catch (err) {
        console.error("Erro ao salvar pedidos:", {
            message: err.message,
            stack: err.stack,
            inputData: req.body
        });

        res.status(500).json({
            success: false,
            error: "Erro ao processar pedidos",
            details: process.env.NODE_ENV === 'development' ? err.message : null
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (closeErr) {
                console.error("Erro ao fechar conexão:", closeErr);
            }
        }
    }
}

// Load items directly from Sankhya (TGFITE)
async function carregarItensSankhya(req, res) {
    console.log('=== CARREGAR ITENS SANKHYA - API chamada ===');
    const { nunota } = req.query;
    let conn;

    if (!nunota) {
        return res.status(400).json({ error: 'NUNOTA é obrigatório' });
    }

    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            `SELECT I.CODPROD, I.QTDNEG, I.VLRUNIT, I.VLRTOT, 
                    (SELECT DESCRPROD FROM TGFPRO WHERE CODPROD = I.CODPROD) AS DESCRPROD,
                    (SELECT REFERENCIA FROM TGFPRO WHERE CODPROD = I.CODPROD) AS REFERENCIA
             FROM TGFITE I
             WHERE I.NUNOTA = :nunota
             ORDER BY I.SEQUENCIA`,
            { nunota: Number(nunota) },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Itens Sankhya encontrados:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao carregar itens sankhya:', err);
        res.status(500).json({ error: 'Erro ao carregar itens sankhya' });
    } finally {
        if (conn) {
            try { await conn.close(); } catch (e) { console.error(e); }
        }
    }
}

// Save edited items back to Sankhya and finalize order (PENDENTE = 'N')
async function salvarItensSankhya(req, res) {
    console.log('=== SALVAR ITENS SANKHYA E LANÇAR - API chamada ===');
    const { nunota, items } = req.body;
    let conn;

    if (!nunota || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'NUNOTA e items são obrigatórios' });
    }

    try {
        conn = await db.getConnection();

        // Update each item in TGFITE
        for (const item of items) {
            const vlrUnit = Number(item.vlrunit);
            if (!isNaN(vlrUnit)) {
                await conn.execute(
                    `UPDATE TGFITE 
                     SET VLRUNIT = :vlrUnit, 
                         VLRTOT = (:vlrUnit * QTDNEG) 
                     WHERE NUNOTA = :nunota AND CODPROD = :codprod`,
                    {
                        vlrUnit: vlrUnit,
                        nunota: Number(nunota),
                        codprod: Number(item.codprod)
                    },
                    { autoCommit: false }
                );
            }
        }

        // Update TGFCAB to set new total and mark PENDENTE = 'N'
        await conn.execute(
            `UPDATE TGFCAB 
             SET VLRNOTA = (SELECT SUM(VLRTOT) FROM TGFITE WHERE NUNOTA = :nunota),
                 PENDENTE = 'N'
             WHERE NUNOTA = :nunota`,
            { nunota: Number(nunota) },
            { autoCommit: true } // Commit everything together
        );

        console.log('Sankhya itens foram atualizados e pedido lançado para NUNOTA:', nunota);
        res.json({ success: true, message: 'Pedido lançado com sucesso!' });

    } catch (err) {
        console.error('Erro ao salvar itens sankhya:', err);
        res.status(500).json({ error: 'Erro ao salvar e lançar itens no Sankhya' });
    } finally {
        if (conn) {
            try { await conn.close(); } catch (e) { console.error(e); }
        }
    }
}

// Finalize order with edited item prices
async function finalizarPedidoComValores(req, res) {
    console.log('=== FINALIZAR PEDIDO COM VALORES E LANCAR - API chamada ===');
    const { idPagamento, idFornecedor, cod_pagamento, cod_fornecedor, numero_pedido, items } = req.body;
    
    // Converter numero_pedido para Number para evitar erro de tipo no Oracle
    const numPedidoInt = Number(numero_pedido);
    const codPagInt = Number(cod_pagamento);
    const codFornInt = Number(cod_fornecedor);
    
    console.log('Dados recebidos:', { 
        idPagamento, idFornecedor, cod_pagamento, cod_fornecedor, numero_pedido, numPedidoInt,
        totalItens: items ? items.length : 0 
    });
    
    if (!numPedidoInt || isNaN(numPedidoInt)) {
        return res.status(400).json({ success: false, error: 'numero_pedido inválido', details: `Valor recebido: ${numero_pedido}` });
    }
    if (!codPagInt || isNaN(codPagInt)) {
        return res.status(400).json({ success: false, error: 'cod_pagamento inválido', details: `Valor recebido: ${cod_pagamento}` });
    }
    if (!codFornInt || isNaN(codFornInt)) {
        return res.status(400).json({ success: false, error: 'cod_fornecedor inválido', details: `Valor recebido: ${cod_fornecedor}` });
    }
    
    let conn;

    try {
        conn = await db.getConnection();

        // 1. Atualizar o CABECALHO_PEDIDO_YSC antes da procedure
        console.log('Passo 1: Atualizando CABECALHO_PEDIDO_YSC...');
        await conn.execute(
            `UPDATE CABECALHO_PEDIDO_YSC 
             SET FORMA_PAGTO = :formaPag,
                 PARCEIRO = :fornecedor,
                 COD_FORMA_PAGTO = :codPag,
                 COD_PARCEIRO = :codForn,
                 DATA_PEDIDO = TRUNC(DATA_PEDIDO),
                 ANDAMENTO = 'FINALIZADO'
             WHERE NUMERO_PEDIDO = :numPedido`,
            {
                formaPag: idPagamento,
                fornecedor: idFornecedor,
                codPag: codPagInt,
                codForn: codFornInt,
                numPedido: numPedidoInt
            },
            { autoCommit: false }
        );
        console.log('Passo 1: CABECALHO atualizado com sucesso');

        // Processar os itens em PEDIDO_PROCESSADO_YSC recebidos do Frontend
        if (items && Array.isArray(items)) {
            const codprods = items.map(it => Number(it.codprod)).filter(c => !isNaN(c));

            // 1. Apagar os que foram excluídos (usando bind variables para segurança)
            if (codprods.length > 0) {
                // Construir placeholders dinâmicos para evitar SQL injection
                const binds = { numPedido: numPedidoInt };
                const placeholders = codprods.map((cod, i) => {
                    const key = `cod${i}`;
                    binds[key] = cod;
                    return `:${key}`;
                });
                await conn.execute(
                    `DELETE FROM PEDIDO_PROCESSADO_YSC 
                     WHERE NUMERO_PEDIDO = :numPedido 
                     AND CODPROD NOT IN (${placeholders.join(',')})`,
                    binds,
                    { autoCommit: false }
                );
            } else {
                await conn.execute(
                    `DELETE FROM PEDIDO_PROCESSADO_YSC 
                     WHERE NUMERO_PEDIDO = :numPedido`,
                    { numPedido: numPedidoInt },
                    { autoCommit: false }
                );
            }

            // 2. Atualizar a QTD_PEDIR e VLR_TOTAL
            for (const it of items) {
                await conn.execute(
                    `UPDATE PEDIDO_PROCESSADO_YSC 
                     SET VLR_TOTAL = (:qtdPedir * :vlrUnit),
                         QTD_PEDIR = :qtdPedir
                     WHERE NUMERO_PEDIDO = :numPedido AND CODPROD = :codprod`,
                    {
                        qtdPedir: Number(it.qtdPedir || 0),
                        vlrUnit: Number(it.vlrunit || 0),
                        numPedido: numPedidoInt,
                        codprod: Number(it.codprod)
                    },
                    { autoCommit: false }
                );
            }
        }

        // 2. Chamar a procedure
        console.log('Passo 2: Chamando procedure...');
        
        await conn.execute(`SAVEPOINT antes_procedure`);
        
        let mensagemProcedure = null;
        let tentativas = 0;
        const maxTentativas = 3;
        
        while (tentativas < maxTentativas) {
            tentativas++;
            try {
                console.log(`Tentativa ${tentativas}/${maxTentativas} para pedido ${numPedidoInt}`);
                
                const result = await conn.execute(
                    `BEGIN
                        JIVA.STP_GERARPEDCOMPRA_IMPORT_YSC(:P_NUM_PEDIDO, :P_MENSAGEM);
                    END;`,
                    {
                        P_NUM_PEDIDO: numPedidoInt,
                        P_MENSAGEM: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
                    },
                    { autoCommit: false }
                );
                mensagemProcedure = result.outBinds.P_MENSAGEM;
                console.log('Procedure executada com sucesso na tentativa', tentativas, '- Mensagem:', mensagemProcedure);
                break;
            } catch (procErr) {
                console.error(`Erro na tentativa ${tentativas}:`, procErr.message);
                if (procErr.message.includes('ORA-01422') && tentativas < maxTentativas) {
                    console.log(`ORA-01422 persistente. Rollback ao savepoint e aguardando...`);
                    try {
                        await conn.execute(`ROLLBACK TO SAVEPOINT antes_procedure`);
                    } catch (rbErr) {
                        console.error('Erro no rollback to savepoint:', rbErr.message);
                    }
                    const waitMs = Math.pow(2, tentativas) * 1000;
                    console.log(`Aguardando ${waitMs}ms antes da tentativa ${tentativas + 1}...`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    await conn.execute(`SAVEPOINT antes_procedure`);
                    continue;
                }
                throw procErr;
            }
        }

        // 3. Pegar NUNOTA gerada
        console.log('Passo 3: Buscando NUNOTA gerada...');
        const cabResult = await conn.execute(
            `SELECT NUNOTA FROM CABECALHO_PEDIDO_YSC WHERE NUMERO_PEDIDO = :numPedido`,
            { numPedido: numPedidoInt },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const nunotaGerado = cabResult.rows && cabResult.rows.length > 0 ? cabResult.rows[0].NUNOTA : null;
        console.log('NUNOTA gerada:', nunotaGerado);

        // 4. Update TGFITE and TGFCAB with specific prices and PENDENTE = 'N'
        if (nunotaGerado && items && Array.isArray(items)) {
            for (const item of items) {
                const vlrUnit = Number(item.vlrunit);
                if (!isNaN(vlrUnit)) {
                    await conn.execute(
                        `UPDATE TGFITE 
                         SET VLRUNIT = :vlrUnit, 
                             VLRTOT = (:vlrUnit * QTDNEG) 
                         WHERE NUNOTA = :nunota AND CODPROD = :codprod`,
                        {
                            vlrUnit: vlrUnit,
                            nunota: Number(nunotaGerado),
                            codprod: Number(item.codprod)
                        },
                        { autoCommit: false }
                    );
                }
            }

            await conn.execute(
                `UPDATE TGFCAB 
                 SET VLRNOTA = (SELECT SUM(VLRTOT) FROM TGFITE WHERE NUNOTA = :nunota),
                     PENDENTE = 'S',
                     STATUSNOTA = 'A',
                     DTNEG = (SELECT TRUNC(DATA_PEDIDO) FROM CABECALHO_PEDIDO_YSC WHERE NUMERO_PEDIDO = :numPedido)
                 WHERE NUNOTA = :nunota`,
                {
                    nunota: Number(nunotaGerado),
                    numPedido: Number(numero_pedido)
                },
                { autoCommit: false }
            );
        }

        await conn.commit();

        res.json({
            success: true,
            result: "Pedido Finalizado com Sucesso e VLRUNIT ajustado",
            mensagemProcedure: mensagemProcedure,
            nunota: nunotaGerado
        });

    } catch (err) {
        console.error('Erro ao finalizar pedido com valores:', err.message);
        console.error('Stack:', err.stack);
        if (conn) {
            try { await conn.rollback(); } catch (rErr) { console.error('Erro no rollback:', rErr); }
        }
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao finalizar pedido', 
            details: err.message,
            errorCode: err.errorNum || null
        });
    } finally {
        if (conn) {
            try { await conn.close(); } catch (e) { console.error(e); }
        }
    }
}

// Renderizar a View do Painel de Pedidos
async function painelPedidos(req, res) {
    res.render('pedidos/painelPedidos', { user: req.user });
}

// Retornar os dados classificados para o Painel
async function getPainelDados(req, res) {
    let conn;
    try {
        conn = await db.getConnection();

        const query = `
            SELECT 
                C.NUNOTA,
                C.NUMNOTA,
                C.DTPREVENT as DTPREVENT,
                C.DTNEG,
                C.VLRNOTA,
                E.NOMEFANTASIA AS EMPRESA,
                P.RAZAOSOCIAL AS PARCEIRO,
                CASE 
                    WHEN TRUNC(C.DTPREVENT) >= TRUNC(SYSDATE) THEN 'PRAZO'
                    WHEN TRUNC(C.DTPREVENT) < TRUNC(SYSDATE) AND TRUNC(C.DTPREVENT) >= TRUNC(SYSDATE) - 7 THEN 'ATRASADO'
                    ELSE 'CRITICO'
                END AS CLASSIFICACAO,
                TRUNC(SYSDATE) - TRUNC(C.DTPREVENT) AS DIAS_ATRASO
            FROM TGFCAB C
            INNER JOIN TSIEMP E ON C.CODEMP = E.CODEMP
            INNER JOIN TGFPAR P ON C.CODPARC = P.CODPARC
            WHERE C.TIPMOV = 'O' 
              AND C.PENDENTE = 'S'
            ORDER BY C.DTPREVENT ASC
        `;

        const result = await conn.execute(query, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });

        res.json({
            success: true,
            pedidos: result.rows
        });
    } catch (err) {
        console.error('Erro ao buscar dados do painel:', err);
        res.status(500).json({ error: 'Erro ao buscar painel de pedidos' });
    } finally {
        if (conn) {
            try { await conn.close(); } catch (e) { console.error(e); }
        }
    }
}

// Reprocessar Pedido Finalizado
async function reprocessarPedido(req, res) {
    console.log('=== REPROCESSAR PEDIDO - API chamada ===');
    const { id } = req.params; // oldId
    let conn;

    try {
        conn = await db.getConnection();

        // 1. Criar novo cabeçalho usando PL/SQL para retornar o ID e copiar os dados com segurança
        const cabResult = await conn.execute(
            `DECLARE
                v_MARCA CABECALHO_PEDIDO_YSC.MARCA%TYPE;
                v_DATA_INICIAL CABECALHO_PEDIDO_YSC.DATA_INICIAL%TYPE;
                v_DATA_FINAL CABECALHO_PEDIDO_YSC.DATA_FINAL%TYPE;
                v_GRUPO CABECALHO_PEDIDO_YSC.GRUPO%TYPE;
                v_EMPRESA CABECALHO_PEDIDO_YSC.EMPRESA%TYPE;
                v_FORMA_PAGTO CABECALHO_PEDIDO_YSC.FORMA_PAGTO%TYPE;
                v_PARCEIRO CABECALHO_PEDIDO_YSC.PARCEIRO%TYPE;
                v_COD_FORMA_PAGTO CABECALHO_PEDIDO_YSC.COD_FORMA_PAGTO%TYPE;
                v_COD_PARCEIRO CABECALHO_PEDIDO_YSC.COD_PARCEIRO%TYPE;
                v_CODEMP CABECALHO_PEDIDO_YSC.CODEMP%TYPE;
                v_VLRTOTAL CABECALHO_PEDIDO_YSC.VLRTOTAL%TYPE;
                v_new_id NUMBER;
             BEGIN
                 SELECT MARCA, DATA_INICIAL, DATA_FINAL, GRUPO, EMPRESA, FORMA_PAGTO, PARCEIRO, COD_FORMA_PAGTO, COD_PARCEIRO, CODEMP, VLRTOTAL
                 INTO v_MARCA, v_DATA_INICIAL, v_DATA_FINAL, v_GRUPO, v_EMPRESA, v_FORMA_PAGTO, v_PARCEIRO, v_COD_FORMA_PAGTO, v_COD_PARCEIRO, v_CODEMP, v_VLRTOTAL
                 FROM CABECALHO_PEDIDO_YSC 
                 WHERE NUMERO_PEDIDO = :oldId;

                 INSERT INTO CABECALHO_PEDIDO_YSC 
                 (MARCA, DATA_INICIAL, DATA_FINAL, GRUPO, DATA_PEDIDO, ANDAMENTO, EMPRESA, FORMA_PAGTO, PARCEIRO, COD_FORMA_PAGTO, COD_PARCEIRO, CODEMP, DATAENTREGA, DATAFATURAMENTO, VLRTOTAL) 
                 VALUES (v_MARCA, v_DATA_INICIAL, v_DATA_FINAL, v_GRUPO, TRUNC(SYSDATE), 'FINALIZADO', v_EMPRESA, v_FORMA_PAGTO, v_PARCEIRO, v_COD_FORMA_PAGTO, v_COD_PARCEIRO, v_CODEMP, TRUNC(SYSDATE), TRUNC(SYSDATE), v_VLRTOTAL)
                 RETURNING NUMERO_PEDIDO INTO v_new_id;

                 :newId := v_new_id;
             END;`,
            {
                oldId: id,
                newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: false }
        );
        const novoPedidoId = cabResult.outBinds.newId;

        // 2. Copiar itens descobrindo as colunas dinamicamente
        const colResult = await conn.execute(
            `SELECT COLUMN_NAME
             FROM user_tab_columns
             WHERE table_name = 'PEDIDO_PROCESSADO_YSC' AND column_name != 'NUMERO_PEDIDO'`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (colResult.rows.length === 0) {
            throw new Error("Colunas da tabela PEDIDO_PROCESSADO_YSC não encontradas. Verifique permissões.");
        }

        const colSet = new Set(colResult.rows.map(r => r.COLUMN_NAME));
        const colStr = Array.from(colSet).join(', ');

        await conn.execute(
            `INSERT INTO PEDIDO_PROCESSADO_YSC (NUMERO_PEDIDO, ${colStr})
             SELECT :newId, ${colStr} FROM PEDIDO_PROCESSADO_YSC WHERE NUMERO_PEDIDO = :oldId`,
            { newId: novoPedidoId, oldId: id },
            { autoCommit: false }
        );

        // 3. Chamar a procedure
        const procResult = await conn.execute(
            `BEGIN
                JIVA.STP_GERARPEDCOMPRA_IMPORT_YSC(
                    :P_NUM_PEDIDO,
                    :P_MENSAGEM
                );
            END;`,
            {
                P_NUM_PEDIDO: novoPedidoId,
                P_MENSAGEM: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
            },
            { autoCommit: false }
        );
        const mensagemProcedure = procResult.outBinds.P_MENSAGEM;

        // 4. Pegar NUNOTA gerada
        const nunotaResult = await conn.execute(
            `SELECT NUNOTA FROM CABECALHO_PEDIDO_YSC WHERE NUMERO_PEDIDO = :numPedido`,
            { numPedido: novoPedidoId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const nunotaGerado = nunotaResult.rows[0] && nunotaResult.rows[0].NUNOTA;

        // 5. Ajustar TGFITE e TGFCAB
        if (nunotaGerado) {
            await conn.execute(
                `UPDATE TGFITE I
                 SET (VLRUNIT, VLRTOT) = (
                     SELECT (VLR_TOTAL / NULLIF(QTD_PEDIR, 0)), VLR_TOTAL
                     FROM PEDIDO_PROCESSADO_YSC 
                     WHERE NUMERO_PEDIDO = :numPedido AND CODPROD = I.CODPROD
                 )
                 WHERE NUNOTA = :nunota
                   AND EXISTS (
                       SELECT 1 FROM PEDIDO_PROCESSADO_YSC 
                       WHERE NUMERO_PEDIDO = :numPedido AND CODPROD = I.CODPROD
                   )`,
                {
                    nunota: Number(nunotaGerado),
                    numPedido: Number(novoPedidoId)
                },
                { autoCommit: false }
            );

            await conn.execute(
                `UPDATE TGFCAB 
                 SET VLRNOTA = (SELECT SUM(VLRTOT) FROM TGFITE WHERE NUNOTA = :nunota),
                     PENDENTE = 'S',
                     STATUSNOTA = 'A',
                     DTNEG = (SELECT TRUNC(DATA_PEDIDO) FROM CABECALHO_PEDIDO_YSC WHERE NUMERO_PEDIDO = :numPedido)
                 WHERE NUNOTA = :nunota`,
                {
                    nunota: Number(nunotaGerado),
                    numPedido: Number(novoPedidoId)
                },
                { autoCommit: false }
            );
        }

        await conn.commit();

        res.json({
            success: true,
            result: "Pedido Reprocessado com Sucesso",
            novoPedidoId,
            nunotaGerado,
            mensagemProcedure
        });

    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch (rErr) { console.error(rErr); }
        }
        res.status(500).json({ error: 'Erro ao reprocessar pedido', details: err.message });
    } finally {
        if (conn) {
            try { await conn.close(); } catch (e) { console.error(e); }
        }
    }
}

module.exports = {
    // View routes
    index,
    listaPedidos,
    fazerPedidos,
    finalizarPedidos,
    pedidosFinalizados,

    // API endpoints
    carregarMarcas,
    carregarFornecedores,
    carregarFormaPagamentos,
    criarPedido,
    consultarPedidos,
    consultarPedidosFeitos,
    consultarPedidosCompleto,
    loadPedidos,
    fecharPedido,
    finalizarPedidoFinal,
    exportarPdf,
    salvarPedidos,
    atualizarPedidoFeito,
    carregarItensSankhya,
    salvarItensSankhya,
    finalizarPedidoComValores,
    painelPedidos,
    getPainelDados,
    reprocessarPedido
};
