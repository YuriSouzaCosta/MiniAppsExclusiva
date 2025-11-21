async function index(req, res) {
    res.render('calculadoraCusto/index', { user: req.user });
}

module.exports = {
    index
};
