exports.home = (req, res) => {
    res.render('pages/home', {
      title: 'Página Inicial',
      layout: 'layouts/main',    // layout base
      extraSidebar: null,        // sem sidebar extra nessa página
      user: req.session.user     // exemplo: passando usuário logado
    });
  };
  