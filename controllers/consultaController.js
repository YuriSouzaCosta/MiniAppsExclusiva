// controllers/consultaController.js
const oracledb = require("oracledb");

async function consultaProduto(req, res) {
    const { codbarra } = req.params;

    let conn;

    try {
        conn = await oracledb.getConnection();

        const result = await conn.execute(
            `
              SELECT 
                PRO.DESCRPROD,
                NVL(SNK_PRECO(0,pro.codprod), 0) AS PRECO
            FROM TGFPRO PRO            
            WHERE pro.referencia like '%:codbarra%'
              
            `,
            { codbarra },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            return res.json({
                descricao: "PRODUTO NAO ENCONTRADO",
                preco: 0
            });
        }

        const produto = result.rows[0];

        return res.json({
            descricao: produto.DESCRPROD,
            preco: Number(produto.PRECO)
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            descricao: "ERRO",
            preco: 0
        });

    } finally {
        if (conn) await conn.close();
    }
}

async function consultaGertec(req, res) {
    console.log("=== API DO BUSCA PREÇO GERTEC ACESSADA! ===");
    console.log("-> Código recebido na URL:", req.params.codbarra);

    const { codbarra } = req.params;

    let conn;

    try {
        conn = await oracledb.getConnection();

        // O Busca Preço Gertec exige uma resposta direta e rápida em texto.
        const result = await conn.execute(
            `
              SELECT 
                PRO.DESCRPROD,
                NVL(SNK_PRECO(0,pro.codprod), 0) AS PRECO
            FROM TGFPRO PRO            
            WHERE pro.referencia = :codbarra
            FETCH FIRST 1 ROWS ONLY
            `,
            { codbarra },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');

        if (result.rows.length === 0) {
            // Display padrão Gertec tem 2 linhas de 20 caracteres
            return res.send("PRODUTO NAO         \nENCONTRADO          ");
        }

        const produto = result.rows[0];

        // Formata para 2 linhas de 20 caracteres
        const top_line = produto.DESCRPROD.substring(0, 20).padEnd(20, ' ');
        // Força a exibição com 2 casas decimais, trocar "." por ",".
        const bottom_line = `R$ ${Number(produto.PRECO).toFixed(2).replace('.', ',')}`.padStart(20, ' ');

        return res.send(`${top_line}\n${bottom_line}`);

    } catch (err) {
        console.error("Erro Busca Preço Gertec:", err);

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(500).send("ERRO NA CONSULTA    \nTENTE NOVAMENTE     ");

    } finally {
        if (conn) await conn.close();
    }
}

async function consultaEanPhp(req, res) {
    const codEan = req.query.ref || '';
    if (codEan === '') {
        return res.send("Erro na solicitação: O código EAN não foi fornecido.");
    }

    let conn;
    const ref = '%' + codEan + '%';
    const sql = "SELECT codprod, referencia, refforn, marca, SNK_PRECO(0,codprod) as preco, YSC_PUXACUSTO_EXC(codprod) as custo_ipi, YSC_PUXACUSTO_S_IPI_EXC(codprod) as custo_s_ipi FROM tgfpro WHERE referencia like :ref";

    try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(sql, { ref }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        let resultados = result.rows;

        if (resultados.length === 0) {
            resultados.push({
                CODPROD: codEan,
                REFERENCIA: "0",
                REFFORN: "0",
                MARCA: "s marca",
                PRECO: "0",
                CUSTO_IPI: "0",
                CUSTO_S_IPI: "0",
                SQL: sql
            });
        }

        res.setHeader('Content-Type', 'application/json');
        return res.json(resultados);

    } catch (err) {
        console.error("Erro consultaEanPhp:", err);
        return res.status(500).send(err.message);
    } finally {
        if (conn) await conn.close();
    }
}

module.exports = {
    consultaProduto,
    consultaGertec,
    consultaEanPhp
};
