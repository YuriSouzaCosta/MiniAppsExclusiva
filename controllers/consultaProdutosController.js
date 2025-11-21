const db = require('../config/db/oracle');
const oracledb = require('oracledb');

async function index(req, res) {
    console.log('=== CONSULTA PRODUTOS INDEX - Rota acessada ===');
    console.log('Path:', req.path);
    // Determine if it's the full version or seller version based on the route path
    const isVendedor = req.path.includes('vendedor');
    console.log('isVendedor:', isVendedor);
    res.render('consultaProdutos/index', { user: req.user, isVendedor });
}

async function getMarcas(req, res) {
    console.log('=== GET MARCAS - API chamada ===');
    let conn;
    try {
        conn = await db.getConnection();
        const result = await conn.execute(
            'SELECT descricao FROM tgfmar ORDER BY descricao ASC',
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('Marcas encontradas:', result.rows.length);
        const marcas = result.rows.map(row => ({ DESCRICAO: row.DESCRICAO }));
        res.json(marcas);
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

async function searchProducts(req, res) {
    console.log('=== SEARCH PRODUCTS - API chamada ===');
    console.log('Query params:', req.query);
    const { term, marca } = req.query;
    let conn;
    try {
        conn = await db.getConnection();

        const searchTerm = term ? term.toUpperCase() : '';
        const searchProd = searchTerm.replace(/ /g, '%');

        let query = `
      SELECT DISTINCT 
        codprod, 
        descrprod, 
        referencia, 
        refforn, 
        ROUND(preco, 2) AS PRECO, 
        marca, 
        ROUND(custo, 2) AS CUSTO, 
        TO_CHAR(ULT_COMPRA, 'DD/MM/YYYY') AS ULT_COMPRA 
      FROM VW_CONSULTA_SITE_YSC 
      WHERE 1=1
    `;

        const bindParams = {};

        // Add marca filter if provided
        if (marca && marca !== 'Selecione a Marca' && marca !== 'Todas as Marcas') {
            query += ` AND marca = :marca`;
            bindParams.marca = marca;
        }

        // Add search term filter if provided - convert referencia and refforn to text for search
        if (searchTerm) {
            query += ` AND (
        UPPER(TO_CHAR(referencia)) LIKE '%' || :searchTerm || '%' 
        OR UPPER(TO_CHAR(refforn)) LIKE '%' || :searchTerm || '%' 
        OR UPPER(descrprod) LIKE '%' || :searchProd || '%'
      )`;
            bindParams.searchTerm = searchTerm;
            bindParams.searchProd = searchProd;
        }

        query += ` ORDER BY DESCRPROD, MARCA, REFERENCIA`;

        const result = await conn.execute(query, bindParams, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });

        console.log('Produtos encontrados:', result.rows.length);
        console.log('Query executada:', query);
        console.log('Parâmetros:', bindParams);

        // Map results to match the expected JSON format
        const products = result.rows.map(row => ({
            CODPROD: row.CODPROD,
            DESCRPROD: row.DESCRPROD,
            REFERENCIA: row.REFERENCIA,
            REFFORN: row.REFFORN,
            PRECO: row.PRECO,
            MARCA: row.MARCA,
            CUSTO: row.CUSTO,
            ULT_COMPRA: row.ULT_COMPRA
        }));

        res.json(products);
    } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
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

async function getStock(req, res) {
    const { codProd } = req.query;
    let conn;
    try {
        conn = await db.getConnection();
        const query = `
      SELECT codemp, razaosocial, estoque 
      FROM VW_CONSULTA_SITE_YSC 
      WHERE codprod = :cod 
      ORDER BY codemp
    `;

        const result = await conn.execute(query, { cod: codProd }, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });

        const stock = result.rows.map(row => ({
            CODEMP: row.CODEMP,
            RAZAOSOCIAL: row.RAZAOSOCIAL,
            ESTOQUE: row.ESTOQUE
        }));

        res.json(stock);
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

module.exports = {
    index,
    getMarcas,
    searchProducts,
    getStock
};
