exports.coletor = (req, res) => {
    res.render('pages/coletor', {
      title: 'Coletor de Produtos',
      layout: 'layouts/main',
      extraSidebar: 'sidebar_coletor', // essa página usa sidebar extra
      user: req.session.user
    });
  };