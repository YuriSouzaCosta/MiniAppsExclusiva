const db = require('../config/db/oracle');
const oracledb = require('oracledb');

// ========== VIEW ROUTES ==========

async function index(req, res) {
    console.log('=== PEDIDO COMPRAS INDEX - Rota acessada ===');
    res.render('pedidoCompras', { user: req.user });
}

async function listaPedidos(req, res) {
    console.log('=== LISTA PEDIDOS - Rota acessada ===');
    res.render('listaPedidos', { user: req.user });
}

async function fazerPedidos(req, res) {
    console.log('=== FAZER PEDIDOS - Rota acessada ===');
    res.render('fazerPedidos', { user: req.user });
}

async function finalizarPedidos(req, res) {
    console.log('=== FINALIZAR PEDIDOS - Rota acessada ===');
    res.render('finalizarPedidos', { user: req.user });
}

async function pedidosFinalizados(req, res) {
    console.log('=== PEDIDOS FINALIZADOS - Rota acessada ===');
    res.render('pedidoFinalizados', { user: req.user });
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

    try {
        conn = await db.getConnection();

        // Insert into orders table (adjust table name and columns as needed)
        const result = await conn.execute(
            `INSERT INTO CABECALHO_PEDIDO_YSC 
             (MARCA, DATA_INICIAL, DATA_FINAL, GRUPO, DATA_PEDIDO, ANDAMENTO) 
             VALUES (:marca, TO_DATE(:dtInit, 'YYYY-MM-DD'), TO_DATE(:dtEnd, 'YYYY-MM-DD'), :gpEmp, SYSDATE, 'Pendente') 
             RETURNING NUMERO_PEDIDO INTO :id`,
            {
                marca,
                dtInit,
                dtEnd,
                gpEmp,
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
             WHERE ANDAMENTO = 'Pendente'
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
             WHERE ANDAMENTO = 'Feito'
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
            `SELECT NUMERO_PEDIDO, NUNOTA, PARCEIRO, MARCA, DATA_PEDIDO, DATA_FATURAMENTO, 
                    DATA_ENTREGA, EMPRESA, ANDAMENTO, FORMA_PAGAMENTO, VALOR_TOTAL 
             FROM CABECALHO_PEDIDO_YSC 
             WHERE ANDAMENTO = 'Finalizado'
             ORDER BY DATA_PEDIDO DESC`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Pedidos finalizados encontrados:', result.rows.length);
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

// Finalize order
async function finalizarPedidoFinal(req, res) {
    console.log('=== FINALIZAR PEDIDO FINAL - API chamada ===');
    console.log('Body:', req.body);

    const { idPagamento, idFornecedor, cod_pagamento, cod_fornecedor, numero_pedido } = req.body;
    let conn;

    try {
        conn = await db.getConnection();

        // Update order with payment and supplier info
        await conn.execute(
            `UPDATE CABECALHO_PEDIDO_YSC 
             SET FORMA_PAGAMENTO = :formaPag,
                 PARCEIRO = :fornecedor,
                 COD_PAGAMENTO = :codPag,
                 COD_FORNECEDOR = :codForn,
                 STATUS = 'Finalizado',
                 ANDAMENTO = 'Finalizado'
             WHERE NUMERO_PEDIDO = :numPedido`,
            {
                formaPag: idPagamento,
                fornecedor: idFornecedor,
                codPag: cod_pagamento,
                codForn: cod_fornecedor,
                numPedido: numero_pedido
            },
            { autoCommit: true }
        );

        console.log('Pedido finalizado:', numero_pedido);
        res.json({ success: true, mensagemProcedure: 'Pedido finalizado com sucesso' });
    } catch (err) {
        console.error('Erro ao finalizar pedido:', err);
        res.status(500).json({ error: 'Erro ao finalizar pedido' });
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
    const { id_pedido } = req.query;
    let conn;

    if (!id_pedido) {
        return res.status(400).json({ error: 'ID do pedido é obrigatório' });
    }

    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            `SELECT * FROM ITENS_PEDIDO_YSC 
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
             ORDER BY ITEM`,
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
    exportarPdf
};
