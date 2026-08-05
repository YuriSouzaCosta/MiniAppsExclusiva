const moment = require('moment');

const db = require('../config/db/oracle');
const oracledb = require('oracledb');
const authMiddleware = require('../middleware/authMiddleware');

exports.getManagerDashboard = async (req, res) => {
    // Default to current month if no dates provided
    const startDate = req.query.startDate ? moment(req.query.startDate).format('DD/MM/YYYY') : moment().startOf('month').format('DD/MM/YYYY');
    const endDate = req.query.endDate ? moment(req.query.endDate).format('DD/MM/YYYY') : moment().endOf('month').format('DD/MM/YYYY');
    const selectedManager = req.query.manager; // For ADMIN filtering
    console.log(startDate, endDate, 'Manager:', selectedManager);

    // Mock data for manager dashboard (default)
    let metrics = {
        dailySales: 0,
        orderCount: 0,
        avgTicket: 0,
        activeSellers: 0
    };

    let topSellers = [];
    let chartData = {
        labels: [],
        values: []
    };

    let managers = [];

    try {
        let baseWhereClause = "WHERE TRUNC(DTNEG) BETWEEN TO_DATE(:startDate, 'DD/MM/YYYY') AND TO_DATE(:endDate, 'DD/MM/YYYY')";
        let binds = { startDate, endDate };

        // Company multi-select filter (applied to all queries)
        let companyFilter = "";
        if (req.query.empresas) {
            const empresas = req.query.empresas
                .split(',')
                .map(e => e.trim())
                .filter(e => e);

            if (empresas.length > 0) {
                const placeholders = empresas.map((_, i) => `:emp${i}`).join(',');
                companyFilter = ` AND CODEMP IN (${placeholders})`;
                empresas.forEach((e, i) => {
                    binds[`emp${i}`] = e;
                });
            }
        }
        baseWhereClause += companyFilter;

        // Manager filter logic (ONLY for metrics as requested)
        let managerFilter = "";
        if (req.user.role === 'ADMIN') {
            // Fetch all managers for the dropdown
            const managersQuery = `SELECT DISTINCT CODVEND, APELIDO FROM VW_LISTFUNCIONARIOS_VENDAS_YSC WHERE TIPVEND = 'G' ORDER BY APELIDO`;
            console.log('SQL (Managers List):', managersQuery);
            const managersResult = await db.simpleExecute(managersQuery);
            managers = managersResult.rows || [];

            if (selectedManager) {
                managerFilter = ` AND CODVEND IN (
                    SELECT CODVEND FROM VW_LISTFUNCIONARIOS_VENDAS_YSC
                    WHERE CODGER = :codger
                )`;
                binds.codger = selectedManager;
            }
        } else {
            // For GERENTE, always filter metrics by their own codger
            managerFilter = ` AND CODVEND IN (
                SELECT CODVEND FROM VW_LISTFUNCIONARIOS_VENDAS_YSC
                WHERE CODGER = :codger
            )`;
            binds.codger = req.user.codger || req.user.codvend;
        }

        // 1. Fetch Metrics (Filtered by Manager)
        const metricsQuery = `SELECT
                COUNT(nunota) AS QTD_PEDIDOS,
                SUM(vlrnota) AS TOTAL_VENDAS,
                COUNT(DISTINCT CODVEND) AS VENDEDORES_ATIVOS
            FROM vw_listPedidos_vendas_ysc
            ${baseWhereClause}
            ${managerFilter}
            AND (
                (CODTIPOPER IN (3105, 3106, 3199, 3200, 3202, 3204))                
            )`;
        console.log('SQL (Metrics):', metricsQuery);
        console.log('Binds (Metrics):', binds);
        const metricsResult = await db.simpleExecute(metricsQuery, binds);

        if (metricsResult.rows && metricsResult.rows.length > 0) {
            const row = metricsResult.rows[0];
            metrics.dailySales = row.TOTAL_VENDAS || 0;
            metrics.orderCount = row.QTD_PEDIDOS || 0;
            metrics.avgTicket = metrics.orderCount > 0 ? metrics.dailySales / metrics.orderCount : 0;
            metrics.activeSellers = row.VENDEDORES_ATIVOS || 0;
        }

        // 2. Fetch Top Sellers (NOT filtered by manager as requested)
        const topSellersQuery = `SELECT 
                v.CODVEND, 
                f.APELIDO, 
                COUNT(v.NUNOTA) AS QTD_VENDAS, 
                SUM(v.VLRNOTA) AS TOTAL_VENDAS
            FROM vw_listPedidos_vendas_ysc v
            LEFT JOIN VW_LISTFUNCIONARIOS_VENDAS_YSC f ON v.CODVEND = f.CODVEND
            WHERE TRUNC(v.DTNEG) BETWEEN TO_DATE(:startDate, 'DD/MM/YYYY') AND TO_DATE(:endDate, 'DD/MM/YYYY')
            
            AND (
                (v.CODTIPOPER IN (3105, 3106, 3199,3200,3202,3204) AND v.STATUSNOTA = 'L')
            )
                ${binds.codger ? 'AND F.CODGER = :codger' : ''}
            GROUP BY v.CODVEND, f.APELIDO
            ORDER BY TOTAL_VENDAS DESC
            FETCH FIRST 5 ROWS ONLY`;
        console.log('SQL (Top Sellers):', topSellersQuery);
        console.log('Binds (Top Sellers):', binds);
        const topSellersResult = await db.simpleExecute(topSellersQuery, binds);
        topSellers = topSellersResult.rows || [];

        // 3. Fetch Performance Chart (Last 7 days) (NOT filtered by manager as requested)
        let chartBinds = {};
        let chartCompanyFilter = "";
        if (req.query.empresas) {
            const empresas = req.query.empresas.split(',').map(e => e.trim()).filter(e => e);
            if (empresas.length > 0) {
                const placeholders = empresas.map((_, i) => `:emp${i}`).join(',');
                chartCompanyFilter = ` AND CODEMP IN (${placeholders})`;
                empresas.forEach((e, i) => { chartBinds[`emp${i}`] = e; });
            }
        }

        const chartQuery = `SELECT 
                TO_CHAR(DTNEG, 'DD/MM') AS DIA_MES,
                TRUNC(DTNEG) AS DATA,
                SUM(VLRNOTA) AS TOTAL_VENDAS,
                COUNT(NUNOTA) AS QTD_PEDIDOS
            FROM vw_listPedidos_vendas_ysc
            WHERE TRUNC(DTNEG) BETWEEN TRUNC(SYSDATE) - 6 AND TRUNC(SYSDATE)
            ${chartCompanyFilter}
            AND (
                (CODTIPOPER IN (3105, 3106, 3199,3200,3202,3204) AND STATUSNOTA = 'L')
                
            )
            GROUP BY TO_CHAR(DTNEG, 'DD/MM'), TRUNC(DTNEG)
            ORDER BY DATA ASC`;
        console.log('SQL (Chart):', chartQuery);
        console.log('Binds (Chart):', chartBinds);
        const chartResult = await db.simpleExecute(chartQuery, chartBinds);

        // Fill gaps for chart data
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            last7Days.push(moment().subtract(i, 'days').format('DD/MM'));
        }

        chartData.labels = last7Days;
        chartData.values = last7Days.map(day => {
            const found = (chartResult.rows || []).find(r => r.DIA_MES === day);
            return found ? found.TOTAL_VENDAS : 0;
        });
        chartData.counts = last7Days.map(day => {
            const found = (chartResult.rows || []).find(r => r.DIA_MES === day);
            return found ? found.QTD_PEDIDOS : 0;
        });

        console.log(`Dashboard updated for period: ${startDate} to ${endDate}`);

    } catch (err) {
        console.error('Error fetching dashboard data:', err);
    }

    res.render('pdv/manager_dashboard', {
        user: req.user,
        metrics,
        topSellers,
        chartData,
        startDate,
        endDate,
        startDateISO: moment(startDate, 'DD/MM/YYYY').format('YYYY-MM-DD'),
        endDateISO: moment(endDate, 'DD/MM/YYYY').format('YYYY-MM-DD'),
        pageTitle: 'Dashboard Gerencial',
        managers,
        selectedManager,
        req // Pass req to access query params in view
    });
};

exports.getSalesDashboard = async (req, res) => {
    const sellerId = req.query.sellerId;
    const isViewingOther = req.user.role === 'ADMIN' && sellerId;

    // Default to current month if no dates provided
    const startDate = req.query.startDate ? moment(req.query.startDate).format('DD/MM/YYYY') : moment().startOf('month').format('DD/MM/YYYY');
    const endDate = req.query.endDate ? moment(req.query.endDate).format('DD/MM/YYYY') : moment().endOf('month').format('DD/MM/YYYY');
    const today = moment().format('DD/MM/YYYY');

    let metrics = {
        dailySales: 0,
        totalSales: 0,
        dailyGoalProgress: 0,
        totalGoalProgress: 0,
        dailyGoal: 5000,
        totalGoal: 100000
    };

    try {
        const codvend = isViewingOther ? sellerId : req.user.codvend;

        // Query for daily sales
        const dailyQuery = `SELECT SUM(vlrnota) AS TOTAL_VENDAS
             FROM vw_listPedidos_vendas_ysc
             WHERE TRUNC(DTNEG) = TO_DATE(:today, 'DD/MM/YYYY')
             AND CODVEND = :codvend
             and codtipoper in (3105,3106,3199,3200,3202,3204)
             and STATUSNOTA = 'L'`;
        console.log('SQL (Daily Sales):', dailyQuery);
        console.log('Binds (Daily Sales):', { today, codvend });
        const dailyResult = await db.simpleExecute(dailyQuery, { today, codvend });

        // Query for total sales in period
        const totalQuery = `SELECT SUM(vlrnota) AS TOTAL_VENDAS
             FROM vw_listPedidos_vendas_ysc
             WHERE TRUNC(DTNEG) BETWEEN TO_DATE(:startDate, 'DD/MM/YYYY') AND TO_DATE(:endDate, 'DD/MM/YYYY')
             AND CODVEND = :codvend
             and codtipoper in (3105,3106,3199,3200,3202,3204)
             `;
        console.log('SQL (Total Sales):', totalQuery);
        console.log('Binds (Total Sales):', { startDate, endDate, codvend });
        const totalResult = await db.simpleExecute(totalQuery, { startDate, endDate, codvend });

        metrics.dailySales = (dailyResult.rows && dailyResult.rows[0].TOTAL_VENDAS) || 0;
        metrics.totalSales = (totalResult.rows && totalResult.rows[0].TOTAL_VENDAS) || 0;

        metrics.dailyGoalProgress = Math.min(Math.round((metrics.dailySales / metrics.dailyGoal) * 100), 100);
        metrics.totalGoalProgress = Math.min(Math.round((metrics.totalSales / metrics.totalGoal) * 100), 100);

        // Query for recent sales of the day
        const recentSalesQuery = `SELECT NUNOTA, ADPEDIDO, VLRNOTA, RAZAOSOCIAL
             FROM vw_listPedidos_vendas_ysc
             WHERE TRUNC(DTNEG) = trunc(sysdate)
             AND CODVEND = :codvend
             and codtipoper in (3105,3106,3199)
             
             union all
SELECT NUNOTA, ADPEDIDO, VLRNOTA, RAZAOSOCIAL
             FROM vw_listPedidos_vendas_ysc
             WHERE TRUNC(DTNEG) = trunc(sysdate)
             AND CODVEND = :codvend
             and codtipoper in (9)
             and pendente = 'S'             
             ORDER BY NUNOTA DESC`;
        console.log('SQL (Recent Sales):', recentSalesQuery);
        console.log('Binds (Recent Sales):', { codvend });
        const recentSalesResult = await db.simpleExecute(recentSalesQuery, { codvend });

        var recentSales = recentSalesResult.rows || [];

    } catch (err) {
        console.error('Error fetching sales dashboard data:', err);
        var recentSales = [];
    }

    res.render('pdv/sales_dashboard', {
        user: req.user,
        metrics,
        startDate,
        endDate,
        recentSales,
        pageTitle: 'Dashboard de Vendas',
        viewingSeller: isViewingOther ? 'Vendedor ' + sellerId : null
    });
};

exports.getNewOrder = (req, res) => {
    res.render('pdv/new_order', {
        user: req.user,
        pageTitle: 'Novo Pedido'
    });
};

exports.postOrder = async (req, res) => {
    let conn;
    try {
        const { nunota, items, additionalDiscount } = req.body;
        console.log('Order items received for NUNOTA:', nunota, items);

        if (!nunota || !Array.isArray(items) || !items.length) {
            return res.status(400).json({ success: false, message: 'NUNOTA não informada' });
        }

        conn = await db.getConnection();

        // Retrieve CODEMP from TGFCAB
        const cabResult = await conn.execute(
            `SELECT CODEMP, CODVEND FROM TGFCAB WHERE NUNOTA = :nunota`,
            { nunota }
        );

        if (!cabResult.rows || cabResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Cabeçalho do pedido não encontrado' });
        }

        const codemp = cabResult.rows[0].CODEMP;
        const vendedorPedido = cabResult.rows[0].CODVEND;
        if (req.user.role !== 'ADMIN' && Number(vendedorPedido) !== Number(req.user.codvend)) {
            return res.status(403).json({ success: false, message: 'Você não pode alterar pedido de outro vendedor' });
        }
        console.log(`Retrieved CODEMP from TGFCAB for NUNOTA ${nunota}:`, codemp);

        if (!codemp) {
            console.error('CODEMP is null or undefined for NUNOTA:', nunota);
            return res.status(400).json({ success: false, message: 'Empresa não encontrada no cabeçalho do pedido' });
        }

        // Insert items into TGFITE
        let sequencia = 1;
        for (const item of items) {
            const p_nunota = Number(nunota);
            const p_sequencia = Number(sequencia++);
            const p_codemp = Number(codemp);
            const p_codprod = Number(item.code);
            const p_qtd = Number(item.quantity);
            const p_vlr = Number(item.price);
            const p_total = Number((item.price * item.quantity) - (item.discount || 0));

            if (isNaN(p_nunota) || isNaN(p_sequencia) || isNaN(p_codemp) || isNaN(p_codprod) || isNaN(p_qtd) || isNaN(p_vlr) || isNaN(p_total)) {
                console.error('Invalid numeric parameters for TGFITE insert:', {
                    nunota, sequencia: sequencia - 1, codemp, item,
                    converted: { p_nunota, p_sequencia, p_codemp, p_codprod, p_qtd, p_vlr, p_total }
                });
                throw new Error(`Dados inválidos para o item ${item.code || 'desconhecido'}. Verifique as quantidades e preços.`);
            }

            console.log(`Inserting item ${p_codprod} with SEQUENCIA ${p_sequencia} and CODEMP ${p_codemp}`);
            await conn.execute(
                `INSERT INTO TGFITE (NUNOTA, SEQUENCIA, CODEMP, CODPROD, QTDNEG, VLRUNIT, VLRTOT, CODVOL, CODLOCALORIG)
                 VALUES (:nunota, :sequencia, :codemp, :codprod, :qtd, :vlr, :total, 'UN', 110000)`,
                {
                    nunota: p_nunota,
                    sequencia: p_sequencia,
                    codemp: p_codemp,
                    codprod: p_codprod,
                    qtd: p_qtd,
                    vlr: p_vlr,
                    total: p_total
                }
            );
        }

        // Calculate total order value and update TGFCAB
        const totalOrderValue = items.reduce((sum, item) => {
            return sum + (Number(item.price) * Number(item.quantity)) - (Number(item.discount) || 0);
        }, 0) - (Number(additionalDiscount) || 0);

        console.log(`Updating VLRNOTA for NUNOTA ${nunota} to ${totalOrderValue}`);
        await conn.execute(
            `UPDATE TGFCAB SET VLRNOTA = :total WHERE NUNOTA = :nunota`,
            { total: totalOrderValue, nunota: Number(nunota) }
        );

        await conn.commit();
        res.json({ success: true, message: 'Pedido finalizado com sucesso!', orderId: nunota });
    } catch (error) {
        if (conn) await conn.rollback();
        console.error('Error saving order items:', error);
        res.status(500).json({ success: false, message: 'Erro ao salvar itens do pedido: ' + error.message });
    } finally {
        if (conn) await conn.close();
    }
};

exports.createOrderHeader = async (req, res) => {
    const { codparc, codtipvenda } = req.body;
    const { codemp, codvend } = req.user;

    console.log('Creating order header - raw values:', { codemp, codparc, codtipvenda, codvend });

    // Explicit conversion to Number to avoid ORA-06502
    const p_codemp = Number(codemp);
    const p_codparc = codparc ? Number(codparc) : 1;
    const p_codtipvenda = Number(codtipvenda);
    const p_codvend = Number(codvend);

    // Validation
    if (isNaN(p_codemp) || isNaN(p_codparc) || isNaN(p_codtipvenda) || isNaN(p_codvend)) {
        console.error('Invalid numeric parameters for STP_GERARCABVENDA_IMPORT_YSC:', {
            codemp, codparc, codtipvenda, codvend,
            converted: { p_codemp, p_codparc, p_codtipvenda, p_codvend }
        });
        return res.status(400).json({
            success: false,
            message: 'Parâmetros inválidos: todos os códigos devem ser numéricos. Verifique se o cliente e a forma de pagamento foram selecionados corretamente.'
        });
    }

    let conn;
    try {
        conn = await db.getConnection();

        const result = await conn.execute(
            `BEGIN
                JIVA.STP_GERARCABVENDA_IMPORT_YSC(
                    :P_MENSAGEM,
                    :P_NUNOTA,
                    :P_CODEMP,
                    :P_CODPARC,
                    :P_CODTIPVENDA,
                    :P_CODVEND
                );
            END;`,
            {

                P_MENSAGEM: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
                P_NUNOTA: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                P_CODEMP: p_codemp,
                P_CODPARC: p_codparc,
                P_CODTIPVENDA: p_codtipvenda,
                P_CODVEND: p_codvend
            }
        );

        const nunota = result.outBinds.P_NUNOTA;
        const mensagem = result.outBinds.P_MENSAGEM;

        console.log('Order header created. NUNOTA:', nunota, 'Message:', mensagem);

        if (nunota) {
            console.log(`Forçando CODVEND = ${p_codvend} no cabeçalho do pedido ${nunota}`);
            await conn.execute(
                `UPDATE TGFCAB SET CODVEND = :codvend WHERE NUNOTA = :nunota`,
                { codvend: p_codvend, nunota: Number(nunota) },
                { autoCommit: true }
            );
        }

        res.json({ success: true, nunota, mensagem });
    } catch (error) {
        console.error('Error calling STP_GERARCABVENDA_IMPORT_YSC:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar cabeçalho do pedido: ' + error.message });
    } finally {
        if (conn) await conn.close();
    }
};

exports.getMarcas = async (req, res) => {
    try {
        const result = await db.simpleExecute(
            'SELECT DISTINCT DESCRICAO FROM tgfmar ORDER BY DESCRICAO ASC'
        );
        res.json(result.rows || []);
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ error: 'Erro ao buscar marcas' });
    }
};

exports.searchProducts = async (req, res) => {
    const { term, marca } = req.query;
    console.log('PDV Product Search Term:', term, 'Marca:', marca);

    if ((!term || term.length < 3) && !marca) {
        return res.json([]);
    }

    try {
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
            WHERE ATIVO = 'S'
        `;

        const bindParams = {};

        if (marca && marca !== 'Todas as Marcas') {
            query += ` AND marca = :marca`;
            bindParams.marca = marca;
        }

        if (searchTerm) {
            query += ` AND (
                UPPER(TO_CHAR(referencia)) LIKE '%' || :searchTerm || '%' 
                OR UPPER(TO_CHAR(refforn)) LIKE '%' || :searchTerm || '%' 
                OR UPPER(descrprod) LIKE '%' || :searchProd || '%'
            )`;
            bindParams.searchTerm = searchTerm;
            bindParams.searchProd = searchProd;
        }

        query += ` ORDER BY DESCRPROD`;

        const result = await db.simpleExecute(query, bindParams);

        const products = result.rows.map(row => ({
            id: row.CODPROD, // Mapping for frontend compatibility
            code: row.CODPROD,
            name: row.DESCRPROD,
            price: row.PRECO,
            category: row.MARCA, // Using MARCA as category for now as requested
            reference: row.REFERENCIA,
            supplierRef: row.REFFORN,
            brand: row.MARCA
        }));

        res.json(products);
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
};

exports.searchPartners = async (req, res) => {
    const { term } = req.query;
    if (!term || term.length < 3) {
        return res.json([]);
    }

    try {
        const result = await db.simpleExecute(
            `SELECT CODPARC, RAZAOSOCIAL, CGC_CPF
             FROM vw_listParceiros_vendas_ysc
             WHERE (UPPER(RAZAOSOCIAL) LIKE UPPER(:term) OR CGC_CPF LIKE :term)
             AND ROWNUM <= 20
             ORDER BY RAZAOSOCIAL`,
            { term: `%${term}%` }
        );

        res.json(result.rows || []);
    } catch (error) {
        console.error('Error searching partners:', error);
        res.status(500).json({ error: 'Erro ao buscar parceiros' });
    }
};

exports.getPaymentMethods = async (req, res) => {
    const { type } = req.query;
    console.log('Fetching payment methods for type:', type);
    let whereClause = "";

    if (type === 'avista') {
        whereClause = "WHERE (UPPER(DESCRTIPVENDA) LIKE '%DINHEIRO%' OR UPPER(DESCRTIPVENDA) LIKE '%PIX%' OR UPPER(DESCRTIPVENDA) LIKE '%FLEXIVEL%' OR UPPER(DESCRTIPVENDA) LIKE '%DEBITO%' OR UPPER(DESCRTIPVENDA) LIKE '%A VISTA%')";
    } else if (type === 'cartao') {
        whereClause = "WHERE UPPER(DESCRTIPVENDA) LIKE '%CREDITO%'";
    } else if (type === 'boleto') {
        whereClause = "WHERE UPPER(DESCRTIPVENDA) LIKE '%BOLETO%'";
    } else {
        return res.json([]);
    }

    try {
        const result = await db.simpleExecute(
            `SELECT DISTINCT CODTIPVENDA, DESCRTIPVENDA
             FROM vw_listPagamentos_vendas_ysc
             ${whereClause}
             ORDER BY DESCRTIPVENDA`
        );

        res.json(result.rows || []);
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({ error: 'Erro ao buscar formas de pagamento' });
    }
};

exports.getPdvLogin = (req, res) => {
    res.render('pdv/login', {
        pageTitle: 'Login PDV',
        error: null,
        next: req.query.next || ''
    });
};

exports.postPdvLogin = async (req, res) => {
    const { username, password, next } = req.body;
    const remember = req.body['remember-me'] === 'on';

    try {
        const user = await authMiddleware.authenticatePdv(username, password);

        if (!user) {
            return res.render('pdv/login', {
                pageTitle: 'Login PDV',
                error: 'Usuário ou senha inválidos',
                next: next || ''
            });
        }

        // Generate token
        const token = authMiddleware.generateToken(user);

        // Set cookie
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 7 days or 1 day
        };

        res.cookie(authMiddleware.COOKIE_NAME, token, cookieOptions);

        // Redirect
        if (next) {
            return res.redirect(next);
        }

        // Default redirect based on role
        if (user.role === 'ADMIN' || user.role === 'GERENTE') {
            return res.redirect('/pdv/manager');
        } else {
            return res.redirect('/pdv/sales');
        }

    } catch (error) {
        console.error('Login error:', error);
        res.render('pdv/login', {
            pageTitle: 'Login PDV',
            error: 'Erro ao realizar login. Tente novamente.',
            next: next || ''
        });
    }
};
exports.getMyOrders = async (req, res) => {
    // Default dates
    const startDate = req.query.startDate ? moment(req.query.startDate).format('DD/MM/YYYY') : moment().startOf('month').format('DD/MM/YYYY');
    const endDate = req.query.endDate ? moment(req.query.endDate).format('DD/MM/YYYY') : moment().endOf('month').format('DD/MM/YYYY');

    // Filters
    const status = req.query.status || 'all'; // 'all', 'open', 'invoiced'

    let orders = [];

    try {
        let whereClause = `WHERE TRUNC(DTNEG) BETWEEN TO_DATE(:startDate, 'DD/MM/YYYY') AND TO_DATE(:endDate, 'DD/MM/YYYY')
                           AND CODTIPOPER = 9`;

        let binds = { startDate, endDate };

        // Status Filter
        if (status === 'open') {
            whereClause += ` AND PENDENTE = 'S'`;
        } else if (status === 'invoiced') {
            whereClause += ` AND PENDENTE = 'N'`;
        }

        // Role Filter
        if (req.user.role === 'ADMIN') {
            // Admin sees all, no extra filter needed unless specific manager logic is desired later
        } else if (req.user.role === 'GERENTE') {
            whereClause += ` AND CODVEND IN (SELECT CODVEND FROM VW_LISTFUNCIONARIOS_VENDAS_YSC WHERE CODGER = :codger)`;
            binds.codger = req.user.codger || req.user.codvend;
        } else {
            // Salesperson sees only their own
            whereClause += ` AND CODVEND = :codvend`;
            binds.codvend = req.user.codvend;
        }

        const query = `
            SELECT 
                NUNOTA, 
                TO_CHAR(DTNEG, 'DD/MM/YYYY') AS DTNEG, 
                RAZAOSOCIAL, 
                VLRNOTA, 
                PENDENTE,
                CODVEND,
                (SELECT APELIDO FROM VW_LISTFUNCIONARIOS_VENDAS_YSC WHERE CODVEND = vw_listPedidos_vendas_ysc.CODVEND AND ROWNUM = 1) AS VENDEDOR
            FROM vw_listPedidos_vendas_ysc
            ${whereClause}
            ORDER BY DTNEG DESC, NUNOTA DESC
        `;

        console.log('SQL (My Orders):', query);
        console.log('Binds (My Orders):', binds);

        const result = await db.simpleExecute(query, binds);
        orders = result.rows || [];

    } catch (error) {
        console.error('Error fetching my orders:', error);
    }

    res.render('pdv/my_orders', {
        user: req.user,
        orders,
        startDate,
        endDate,
        startDateISO: moment(startDate, 'DD/MM/YYYY').format('YYYY-MM-DD'),
        endDateISO: moment(endDate, 'DD/MM/YYYY').format('YYYY-MM-DD'),
        status,
        pageTitle: 'Meus Pedidos'
    });
};
exports.getOrderDetails = async (req, res) => {
    const { nunota } = req.query;
    if (!nunota) return res.json({ success: false, message: 'NUNOTA não informado' });

    try {
        // Fetch Header
        const headerQuery = `
            SELECT 
                NUNOTA, CODPARC, CODVEND, CODTIPVENDA, VLRNOTA,
                (SELECT RAZAOSOCIAL FROM TGFPAR WHERE CODPARC = TGFCAB.CODPARC) AS PARCEIRO_NOME,
                (SELECT CGC_CPF FROM TGFPAR WHERE CODPARC = TGFCAB.CODPARC) AS PARCEIRO_CGC,
                (SELECT DESCRTIPVENDA FROM TGFTPV WHERE CODTIPVENDA = TGFCAB.CODTIPVENDA AND DHALTER = (SELECT MAX(DHALTER) FROM TGFTPV WHERE CODTIPVENDA = TGFCAB.CODTIPVENDA)) AS TIPVENDA_DESC
            FROM TGFCAB 
            WHERE NUNOTA = :nunota
        `;
        const headerResult = await db.simpleExecute(headerQuery, { nunota });

        if (!headerResult.rows || headerResult.rows.length === 0) {
            return res.json({ success: false, message: 'Pedido não encontrado' });
        }

        const header = headerResult.rows[0];
        if (req.user.role !== 'ADMIN' && Number(header.CODVEND) !== Number(req.user.codvend)) {
            return res.status(403).json({ success: false, message: 'Você não pode consultar pedido de outro vendedor' });
        }

        // Fetch Items
        const itemsQuery = `
            SELECT 
                i.CODPROD, 
                p.DESCRPROD, 
                p.REFERENCIA,
                p.MARCA,
                i.QTDNEG, 
                i.VLRUNIT, 
                i.VLRTOT,
                (i.QTDNEG * i.VLRUNIT) - i.VLRTOT AS DISCOUNT_VALUE
            FROM TGFITE i
            JOIN TGFPRO p ON i.CODPROD = p.CODPROD
            WHERE i.NUNOTA = :nunota
        `;
        const itemsResult = await db.simpleExecute(itemsQuery, { nunota });

        const items = itemsResult.rows.map(row => ({
            id: row.CODPROD,
            code: row.CODPROD,
            name: row.DESCRPROD,
            reference: row.REFERENCIA,
            brand: row.MARCA,
            price: row.VLRUNIT,
            quantity: row.QTDNEG,
            discount: row.DISCOUNT_VALUE || 0
        }));

        res.json({
            success: true,
            order: {
                nunota: header.NUNOTA,
                nunota: header.NUNOTA,
                codparc: header.CODPARC,
                clientName: header.PARCEIRO_NOME,
                clientCgc: header.PARCEIRO_CGC,
                codtipvenda: header.CODTIPVENDA,
                paymentMethodName: header.TIPVENDA_DESC,
                items: items
            }
        });

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar detalhes do pedido' });
    }
};
