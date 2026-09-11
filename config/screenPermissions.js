const db = require('./db/oracle');
const NO_ROLES = '__NONE__';

const SCREENS = [
  { key: 'transferencias', label: 'Transferências', prefix: '/transferencias', roles: ['ADMIN'] },
  { key: 'analise-transferencias', label: 'Análise de Transferências', prefix: '/analise-transferencias', roles: ['ADMIN'] },
  { key: 'requisicoes', label: 'Requisições entre Lojas', prefix: '/requisicoes', roles: null },
  { key: 'orcamento-ocr', label: 'Orçamento OCR', prefix: '/orcamento-ocr', roles: ['ADMIN'] },
  { key: 'faturamento-marcas', label: 'Faturamento por Marca', prefix: '/faturamento/marcas', roles: ['ADMIN'] },
  { key: 'faturamento', label: 'Faturamento por Vendedor', prefix: '/faturamento', roles: ['ADMIN'] },
  { key: 'compras-marcas', label: 'Compras por Marca', prefix: '/compras-marcas', roles: ['ADMIN'] },
  { key: 'acompanhamento-notas-lite', label: 'Acompanhamento de Notas (Lite)', prefix: '/acompanhamento-notas-lite', roles: null },
  { key: 'acompanhamento-notas', label: 'Acompanhamento de Notas', prefix: '/acompanhamento-notas', roles: ['ADMIN'] },
  { key: 'acompanhamento-financeiro', label: 'Acompanhamento Financeiro', prefix: '/acompanhamento-financeiro', roles: ['ADMIN'] },
  { key: 'receita-despesa', label: 'Receita x Despesa', prefix: '/receita-despesa', roles: ['ADMIN'] },
  { key: 'entrada-saida', label: 'Entrada x Saída', prefix: '/entrada-saida', roles: ['ADMIN'] },
  { key: 'markup', label: 'Markup', prefix: '/markup', roles: ['ADMIN'] },
  { key: 'dre', label: 'DRE', prefix: '/dre', roles: ['ADMIN'] },
  { key: 'fluxo-caixa', label: 'Fluxo de Caixa', prefix: '/fluxo-caixa', roles: ['ADMIN'] },
  { key: 'baixa-boletos', label: 'Baixa de Boletos', prefix: '/baixa-boletos', roles: ['ADMIN', 'ASS_COMPRA'] },
  { key: 'controle-cartao', label: 'Controle de Cartões', prefix: '/controle-cartao', roles: null },
  { key: 'calculadora-custo', label: 'Calculadora de Custo', prefix: '/calculadora-custo', roles: ['ADMIN'] },
  { key: 'consulta-produtos-vendedor', label: 'Consulta de Produtos (Vendedor)', prefix: '/consulta-produtos/vendedor', roles: null },
  { key: 'consulta-produtos', label: 'Consulta de Produtos com Custo', prefix: '/consulta-produtos', roles: ['ADMIN'] },
  { key: 'pedidos-compras', label: 'Pedidos de Compra', prefix: '/pedidosCompras', roles: ['ADMIN', 'ASS_COMPRA'] }
];

function screenForPath(pathname) {
  return [...SCREENS].sort((a, b) => b.prefix.length - a.prefix.length)
    .find(screen => pathname === screen.prefix || pathname.startsWith(`${screen.prefix}/`));
}

async function loadRules() {
  const result = await db.simpleExecute('SELECT TELA, CODROLE FROM AD_TELAS_PERMISSOES');
  const rules = new Map();
  result.rows.forEach(row => {
    const key = String(row.TELA);
    if (!rules.has(key)) rules.set(key, new Set());
    rules.get(key).add(String(row.CODROLE).trim());
  });
  return rules;
}

async function enforceScreenAccess(req, res, next) {
  const screen = screenForPath(req.path);
  const role = String(req.user && req.user.role || '').trim();
  if (!screen || role === 'ADMIN') return next();
  const defaultAllowed = !screen.roles || screen.roles.includes(role);
  try {
    const rules = await loadRules();
    if (rules.has(screen.key)) {
      if (rules.get(screen.key).has(role)) return next();
    } else if (defaultAllowed) {
      // Sem configuração salva, preserva a permissão padrão anterior.
      return next();
    }
    return res.status(403).send('Você não possui permissão para acessar esta tela.');
  } catch (error) {
    // Se a tabela estiver indisponível, mantém a segurança padrão de cada tela.
    if (error.errorNum !== 942) console.error('Erro ao conferir permissão de tela:', error);
    if (defaultAllowed) return next();
    return res.status(403).send('Você não possui permissão para acessar esta tela.');
  }
}

module.exports = { SCREENS, NO_ROLES, screenForPath, loadRules, enforceScreenAccess };
