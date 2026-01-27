const moment = require('moment');

const db = require('../config/db/oracle');
const authMiddleware = require('../middleware/authMiddleware');

exports.getManagerDashboard = async (req, res) => {
    // Default to current month if no dates provided
    const startDate = moment(req.query.startDate).format('DD/MM/YYYY') || moment().startOf('month').format('DD/MM/YYYY');
    const endDate = moment(req.query.endDate).format('DD/MM/YYYY') || moment().endOf('month').format('DD/MM/YYYY');
    console.log(startDate, endDate);

    // Mock data for manager dashboard (default)
    let metrics = {
        dailySales: 45231.89,
        orderCount: 2350,
        avgTicket: 120.00,
        activeSellers: 12
    };

    try {
        // Se for VENDEDOR, filtra apenas as vendas dele
        // Se for GERENTE, filtra as vendas do grupo (TODO: implementar lógica de grupo se necessário)
        // Se for ADMIN, vê tudo

        let whereClause = "WHERE TRUNC(DTNEG) BETWEEN TO_DATE(:startDate, 'DD/MM/YYYY') AND TO_DATE(:endDate, 'DD/MM/YYYY')";
        let binds = { startDate, endDate };

        if (req.user.role === 'VENDEDOR') {
            whereClause += " AND CODVEND = :codvend";
            binds.codvend = req.user.codvend;
        }

        const result = await db.simpleExecute(
            `SELECT
                codvend,
                COUNT(nunota) AS QTD_PEDIDOS,
                SUM(vlrnota) AS TOTAL_VENDAS
            FROM vw_listPedidos_vendas_ysc
            ${whereClause}
            and codtipoper in (3105,3106,3199)
            and STATUSNOTA = 'L'
            GROUP BY codvend
            ORDER BY codvend`,
            binds
        );

        if (result.rows && result.rows.length > 0) {
            metrics.dailySales = result.rows.reduce((total, row) => total + row.TOTAL_VENDAS, 0) || 0;
            metrics.orderCount = result.rows.reduce((total, row) => total + row.QTD_PEDIDOS, 0) || 0;
            metrics.avgTicket = metrics.dailySales / metrics.orderCount || 0;
            metrics.activeSellers = result.rows.length;
        }

        console.log(`Filtering dashboard for period: ${startDate} to ${endDate} for role: ${req.user.role}`);

    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        // Handle error appropriately
    }

    res.render('pdv/manager_dashboard', {
        user: req.user,
        metrics,
        startDate, // Pass startDate to view
        endDate,   // Pass endDate to view
        pageTitle: 'Dashboard Gerencial'
    });
};

exports.getSalesDashboard = async (req, res) => {
    const sellerId = req.query.sellerId;
    const isViewingOther = req.user.role === 'ADMIN' && sellerId;

    // Default to current month if no dates provided
    const startDate = moment(req.query.startDate).format('DD/MM/YYYY') || moment().startOf('month').format('DD/MM/YYYY');
    const endDate = moment(req.query.endDate).format('DD/MM/YYYY') || moment().endOf('month').format('DD/MM/YYYY');
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
        const dailyResult = await db.simpleExecute(
            `SELECT SUM(vlrnota) AS TOTAL_VENDAS
             FROM vw_listPedidos_vendas_ysc
             WHERE TRUNC(DTNEG) = TO_DATE(:today, 'DD/MM/YYYY')
             AND CODVEND = :codvend
             and codtipoper in (3105,3106,3199)
             and STATUSNOTA = 'L'`,
            { today, codvend }
        );

        // Query for total sales in period
        const totalResult = await db.simpleExecute(
            `SELECT SUM(vlrnota) AS TOTAL_VENDAS
             FROM vw_listPedidos_vendas_ysc
             WHERE TRUNC(DTNEG) BETWEEN TO_DATE(:startDate, 'DD/MM/YYYY') AND TO_DATE(:endDate, 'DD/MM/YYYY')
             AND CODVEND = :codvend
             and codtipoper in (3105,3106,3199)
             and STATUSNOTA = 'L'`,
            { startDate, endDate, codvend }
        );

        metrics.dailySales = (dailyResult.rows && dailyResult.rows[0].TOTAL_VENDAS) || 0;
        metrics.totalSales = (totalResult.rows && totalResult.rows[0].TOTAL_VENDAS) || 0;

        metrics.dailyGoalProgress = Math.min(Math.round((metrics.dailySales / metrics.dailyGoal) * 100), 100);
        metrics.totalGoalProgress = Math.min(Math.round((metrics.totalSales / metrics.totalGoal) * 100), 100);

        // Query for recent sales of the day
        const recentSalesResult = await db.simpleExecute(
            `SELECT NUNOTA, ADPEDIDO, VLRNOTA, RAZAOSOCIAL
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
             ORDER BY NUNOTA DESC`,
            { codvend }
        );

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

exports.postOrder = (req, res) => {
    try {
        const orderData = req.body;
        console.log('Order received:', orderData);

        // Here we would save to Oracle DB
        // For now, just return success

        res.json({ success: true, message: 'Pedido realizado com sucesso!', orderId: '2026-' + Math.floor(Math.random() * 1000) });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ success: false, message: 'Erro ao salvar pedido' });
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
