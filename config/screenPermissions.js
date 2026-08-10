const db = require('./db/oracle');

const SCREENS = [
  { key: 'transferencias', label: 'Transferências', prefix: '/transferencias' },
  { key: 'analise-transferencias', label: 'Análise de Transferências', prefix: '/analise-transferencias' },
  { key: 'requisicoes', label: 'Requisições entre Lojas', prefix: '/requisicoes' },
  { key: 'orcamento-ocr', label: 'Orçamento OCR', prefix: '/orcamento-ocr' },
  { key: 'faturamento', label: 'Faturamento por Vendedor', prefix: '/faturamento' },
  { key: 'acompanhamento-notas-lite', label: 'Acompanhamento de Notas (Lite)', prefix: '/acompanhamento-notas-lite' },
  { key: 'acompanhamento-notas', label: 'Acompanhamento de Notas', prefix: '/acompanhamento-notas' },
  { key: 'acompanhamento-financeiro', label: 'Acompanhamento Financeiro', prefix: '/acompanhamento-financeiro' },
  { key: 'receita-despesa', label: 'Receita x Despesa', prefix: '/receita-despesa' },
  { key: 'entrada-saida', label: 'Entrada x Saída', prefix: '/entrada-saida' },
  { key: 'baixa-boletos', label: 'Baixa de Boletos', prefix: '/baixa-boletos' },
  { key: 'controle-cartao', label: 'Controle de Cartões', prefix: '/controle-cartao' },
  { key: 'calculadora-custo', label: 'Calculadora de Custo', prefix: '/calculadora-custo' },
  { key: 'consulta-produtos', label: 'Consulta de Produtos', prefix: '/consulta-produtos' },
  { key: 'pedidos-compras', label: 'Pedidos de Compra', prefix: '/pedidosCompras' }
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
  if (!screen || req.user.role === 'ADMIN') return next();
  try {
    const rules = await loadRules();
    // Sem configuração, o projeto preserva o comportamento anterior.
    if (!rules.has(screen.key) || rules.get(screen.key).has(req.user.role)) return next();
    return res.status(403).send('Você não possui permissão para acessar esta tela.');
  } catch (error) {
    // A migração pode ainda não ter sido aplicada: não interrompe telas existentes.
    if (error.errorNum !== 942) console.error('Erro ao conferir permissão de tela:', error);
    return next();
  }
}

module.exports = { SCREENS, loadRules, enforceScreenAccess };
