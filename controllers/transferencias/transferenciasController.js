const db = require('../../config/db/oracle');
const oracledb = require('oracledb');

// ========== VIEW ROUTES ==========

async function index(req, res) {
    console.log('=== TRANSFERENCIAS INDEX - Rota acessada ===');
    res.render('transferencias/index', { user: req.user });
}

// ========== API ENDPOINTS ==========

// Buscar produto por código de barras
async function buscarProduto(req, res) {
    console.log('=== BUSCAR PRODUTO - API chamada ===');
    const { codigoBarras } = req.params;
    let conn;

    try {
        conn = await db.getConnection();

        // TODO: Ajustar esta query conforme sua estrutura de banco
        const query = `
            SELECT CODPROD, DESCRPROD, REFERENCIA, REFFORN, MARCA
            FROM VW_CONSULTA_SITE_YSC
            WHERE REFERENCIA = :codigoBarras OR REFFORN = :codigoBarras
            AND ROWNUM = 1
        `;

        const result = await conn.execute(
            query,
            { codigoBarras },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        console.log('Produto encontrado:', result.rows[0]);
        res.json(result.rows[0]);

    } catch (err) {
        console.error('Erro ao buscar produto:', err);
        res.status(500).json({ error: 'Erro ao buscar produto' });
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

// Buscar locais de estoque do produto (origem)
async function buscarEstoque(req, res) {
    console.log('=== BUSCAR ESTOQUE - API chamada ===');
    const { codProd } = req.params;
    let conn;

    try {
        conn = await db.getConnection();

        // TODO: Ajustar esta query conforme sua estrutura de banco
        // Deve retornar: CODEMP, RAZAOSOCIAL, CODLOCAL, DESCRLOCAL, ESTOQUE
        const query = `
            SELECT CODEMP, RAZAOSOCIAL, ESTOQUE
            FROM VW_CONSULTA_SITE_YSC
            WHERE CODPROD = :codProd
            AND ESTOQUE > 0
            ORDER BY CODEMP
        `;

        const result = await conn.execute(
            query,
            { codProd },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        console.log('Locais de estoque encontrados:', result.rows.length);
        res.json(result.rows);

    } catch (err) {
        console.error('Erro ao buscar estoque:', err);
        res.status(500).json({ error: 'Erro ao buscar estoque' });
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

// Buscar todos os locais possíveis (destino)
async function buscarLocaisDestino(req, res) {
    console.log('=== BUSCAR LOCAIS DESTINO - API chamada ===');
    let conn;

    try {
        conn = await db.getConnection();

        // TODO: Ajustar esta query conforme sua estrutura de banco
        // Deve retornar todos os locais/empresas disponíveis
        const query = `
            SELECT DISTINCT CODEMP, RAZAOSOCIAL
            FROM VW_CONSULTA_SITE_YSC
            ORDER BY CODEMP
        `;

        const result = await conn.execute(
            query,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        console.log('Locais de destino encontrados:', result.rows.length);
        res.json(result.rows);

    } catch (err) {
        console.error('Erro ao buscar locais destino:', err);
        res.status(500).json({ error: 'Erro ao buscar locais destino' });
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

// Criar transferências em lote
async function criarTransferencias(req, res) {
    console.log('=== CRIAR TRANSFERENCIAS - API chamada ===');
    console.log('Body:', req.body);

    const { transferencias } = req.body; // Array de transferências agrupadas
    let conn;

    try {
        conn = await db.getConnection();

        const resultados = [];

        // Processar cada transferência
        for (const transf of transferencias) {
            const { codProd, empresaOrigem, localOrigem, empresaDestino, localDestino, quantidade } = transf;

            // TODO: Ajustar esta query/procedure conforme seu sistema
            // Exemplo: chamar procedure de transferência
            const result = await conn.execute(
                `BEGIN
                    -- Sua procedure de transferência aqui
                    -- Exemplo fictício:
                    -- STP_CRIAR_TRANSFERENCIA(:codProd, :empOrigem, :localOrigem, :empDestino, :localDestino, :qtd, :resultado);
                    :resultado := 'Transferência criada com sucesso';
                END;`,
                {
                    codProd,
                    empOrigem: empresaOrigem,
                    localOrigem,
                    empDestino: empresaDestino,
                    localDestino,
                    qtd: quantidade,
                    resultado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
                }
            );

            resultados.push({
                codProd,
                empresaOrigem,
                empresaDestino,
                status: 'success',
                mensagem: result.outBinds.resultado
            });
        }

        await conn.commit();

        console.log('Transferências criadas:', resultados.length);
        res.json({
            success: true,
            message: `${resultados.length} transferência(s) criada(s) com sucesso`,
            resultados
        });

    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackErr) {
                console.error('Erro no rollback:', rollbackErr);
            }
        }

        console.error('Erro ao criar transferências:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao criar transferências',
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

module.exports = {
    index,
    buscarProduto,
    buscarEstoque,
    buscarLocaisDestino,
    criarTransferencias
};
