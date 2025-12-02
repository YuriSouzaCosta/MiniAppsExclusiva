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
            `SELECT CODTIPVENDA, DESCRTIPVENDA 
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
             VALUES (:marca, TO_DATE(:dtInit, 'YYYY-MM-DD'), TO_DATE(:dtEnd, 'YYYY-MM-DD'), :gp, SYSDATE, 'ABERTO', :emp) 
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
                    GRUPO, ANDAMENTO, VLRTOTAL 
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
                 ANDAMENTO = 'FINALIZADO'
             WHERE NUMERO_PEDIDO = :numPedido`,
            {
                formaPag: idPagamento,
                fornecedor: idFornecedor,
                codPag: cod_pagamento,
                codForn: cod_fornecedor,
                numPedido: numero_pedido
            },
            { autoCommit: false } // Não commitar ainda
        );

        // 2. Chamar a procedure
        const result = await conn.execute(
            `BEGIN
                JIVA.STP_GERARPEDCOMPRA_IMPORT_YSC(
                    :P_NUM_PEDIDO,
                    :P_MENSAGEM
                );
            END;`,
            {
                P_NUM_PEDIDO: numero_pedido,
                P_MENSAGEM: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
            }
        );

        const mensagemProcedure = result.outBinds.P_MENSAGEM;
        console.log('Mensagem da procedure:', mensagemProcedure);

        // Se chegou até aqui, commit das alterações
        await conn.commit();

        console.log('Pedido finalizado:', numero_pedido);
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
             ORDER BY LINHA`,
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
            `SELECT * FROM PEDIDO_PROCESSADO_YSC 
             WHERE NUMERO_PEDIDO = :numPedido
             ORDER BY CODPROD`,
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
    atualizarPedidoFeito
};
