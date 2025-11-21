const db = require('../config/db/oracle');

async function index(req, res) {
    // Redirect to 'novo' as the default view based on the original index.php
    res.redirect('/controle-cartao/novo');
}

async function create(req, res) {
    res.render('controleCartao/novo', { user: req.user });
}

async function store(req, res) {
    const { nome, cartao, desc } = req.body;
    let conn;

    try {
        conn = await db.getConnection();

        const query = `
      INSERT INTO ad_solicitacao (nome, data_retirada, cod_cartao, situacao, descritivo)
      VALUES (:nome, SYSDATE, :cartao, 'PENDENTE', :desc)
    `;

        await conn.execute(query, {
            nome,
            cartao,
            desc
        }, { autoCommit: true });

        res.redirect('/controle-cartao/pendentes');
    } catch (err) {
        console.error('Erro ao cadastrar solicitação:', err);
        res.status(500).send('Erro ao cadastrar solicitação');
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

async function listPending(req, res) {
    let conn;
    try {
        conn = await db.getConnection();

        const query = `
      SELECT 
        soc.ID_CODE,
        soc.NOME,
        TO_CHAR(soc.DATA_RETIRADA, 'DD/MM/YYYY HH24:MI:SS') as DATA_RETIRADA,
        soc.DATA_DEVOLUCAO,
        soc.COD_CARTAO,
        soc.VALOR,
        soc.PARCEIRO,
        soc.DESCRITIVO,
        soc.VEZESPARCELADO,
        soc.SITUACAO,
        car.CARTAO_DESCR
      FROM ad_solicitacao soc
      INNER JOIN ad_cartoes car ON car.idcartoes = soc.cod_cartao
      WHERE UPPER(soc.SITUACAO) = 'PENDENTE'
    `;

        const result = await conn.execute(query);
        const solicitacoes = result.rows.map(row => ({
            ID_CODE: row.ID_CODE,
            NOME: row.NOME,
            DATA_RETIRADA: row.DATA_RETIRADA,
            CARTAO_DESCR: row.CARTAO_DESCR,
            DESCRITIVO: row.DESCRITIVO
        }));

        res.render('controleCartao/pendentes', { solicitacoes, user: req.user });
    } catch (err) {
        console.error('Erro ao listar pendentes:', err);
        res.status(500).send('Erro ao listar pendentes');
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
    create,
    store,
    listPending
};
