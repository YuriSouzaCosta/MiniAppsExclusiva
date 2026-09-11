const receitaService = require('../services/receitaManual');

function falha(res, error) {
  console.error('receita manual controller:', error.message);
  const status = error.errorNum === 942 ? 503 : (error.status || 500);
  res.status(status).json({
    ok: false,
    erro: error.errorNum === 942
      ? 'A tabela AD_RECEITA_MANUAL ainda não foi instalada no banco.'
      : error.status ? error.message : 'Não foi possível acessar a receita manual. Tente novamente.'
  });
}

async function carregar(req, res) {
  try {
    const empresas = [...new Set(String(req.query.empresas || '').split(',').map(Number))].filter(Boolean);
    if (!empresas.length) {
      return res.status(400).json({ ok: false, erro: 'Selecione pelo menos uma empresa.' });
    }
    if (empresas.length === 7 && String(req.user?.username).trim().toUpperCase() !== 'YURIS') {
      return res.status(403).json({ ok: false, erro: 'O Grupo Exclusiva é restrito ao usuário YURIS.' });
    }
    const data = await receitaService.carregar(req.query.competencia, empresas);
    res.json({ ok: true, ...data });
  } catch (error) {
    falha(res, error);
  }
}

async function salvar(req, res) {
  try {
    const data = await receitaService.salvar(req.body || {}, req.user?.username);
    res.json({ ok: true, ...data });
  } catch (error) {
    falha(res, error);
  }
}

module.exports = { carregar, salvar };
