const db = require('./db/oracle');

const DEFAULT_CATEGORIES = [
  { key: 'vendas-pdv', name: 'Vendas e PDV', icon: 'fa-cash-register', order: 10 },
  { key: 'estoque-lojas', name: 'Estoque e lojas', icon: 'fa-boxes-stacked', order: 20 },
  { key: 'administracao', name: 'Administração', icon: 'fa-user-shield', order: 30 },
  { key: 'produtos-precos', name: 'Produtos e preços', icon: 'fa-tags', order: 40 },
  { key: 'compras', name: 'Compras', icon: 'fa-truck-loading', order: 50 },
  { key: 'fiscal-notas', name: 'Fiscal e notas', icon: 'fa-file-invoice-dollar', order: 60 },
  { key: 'relatorios', name: 'Relatórios', icon: 'fa-chart-column', order: 70 },
  { key: 'financeiro', name: 'Financeiro', icon: 'fa-credit-card', order: 80 }
];

const APPS = [
  { key: 'pdv', category: 'vendas-pdv', title: 'Sistema PDV', description: 'Ponto de venda e caixa', href: '/pdv/login', icon: 'fa-cash-register', roles: null, order: 10 },
  { key: 'faturamento', category: 'vendas-pdv', title: 'Faturamento por Vendedor', description: 'Vendas, painel e metas', href: '/faturamento', icon: 'fa-money-bill-trend-up', roles: ['ADMIN'], order: 20 },
  { key: 'consulta-vend', category: 'vendas-pdv', title: 'Consulta de Produtos', description: 'Preço e estoque', href: '/consulta-produtos/vendedor', icon: 'fa-search-dollar', roles: null, order: 30 },
  { key: 'requisicoes', category: 'estoque-lojas', title: 'Requisições entre Lojas', description: 'Pedidos entre lojas', href: '/requisicoes', icon: 'fa-clipboard-list', roles: null, order: 10 },
  { key: 'transferencias', category: 'estoque-lojas', title: 'Transferências', description: 'Transferir estoque', href: '/transferencias', icon: 'fa-exchange-alt', roles: ['ADMIN'], order: 20 },
  { key: 'analise-transf', category: 'estoque-lojas', title: 'Análise de Transferências', description: 'Relatório de transferências', href: '/analise-transferencias', icon: 'fa-chart-line', roles: ['ADMIN'], order: 30 },
  { key: 'coletor', category: 'estoque-lojas', title: 'Coletor', description: 'Leitor de código de barras', href: '/coletor', icon: 'fa-barcode', roles: null, order: 40 },
  { key: 'gerenciamento-usuarios', category: 'administracao', title: 'Gerenciamento de Usuários', description: 'Defina perfis e permissões', href: '/gerenciamento-usuarios', icon: 'fa-users-gear', roles: ['ADMIN'], order: 10 },
  { key: 'gerenciamento-categorias', category: 'administracao', title: 'Categorias do Painel', description: 'Organize as categorias e acessos', href: '/gerenciamento-categorias', icon: 'fa-folder-tree', roles: ['ADMIN'], order: 20 },
  { key: 'consulta-custo', category: 'produtos-precos', title: 'Consulta de Produtos C/ Custo', description: 'Preço, custo e margem', href: '/consulta-produtos', icon: 'fa-tags', roles: ['ADMIN'], order: 10 },
  { key: 'calc-custo', category: 'produtos-precos', title: 'Calculadora de Custo', description: 'Simula o custo do produto', href: '/calculadora-custo', icon: 'fa-calculator', roles: ['ADMIN'], order: 20 },
  { key: 'pedido-compra', category: 'compras', title: 'Pedido de Compra', description: 'Gera pedidos de compra', href: '/pedidosCompras?', icon: 'fa-truck-loading', roles: ['ADMIN', 'ASS_COMPRA'], order: 10 },
  { key: 'orcamento-ocr', category: 'compras', title: 'Orçamento OCR', description: 'Lê orçamento por foto', href: '/orcamento-ocr', icon: 'fa-file-invoice', roles: ['ADMIN'], order: 20 },
  { key: 'acomp-notas', category: 'fiscal-notas', title: 'Acompanhamento de Notas', description: 'Entrada e status de notas', href: '/acompanhamento-notas', icon: 'fa-file-import', roles: ['ADMIN'], order: 10 },
  { key: 'acomp-notas-lite', category: 'fiscal-notas', title: 'Acompanhamento de Notas (Lite)', description: 'Notas, versão simples', href: '/acompanhamento-notas-lite', icon: 'fa-file-invoice-dollar', roles: null, order: 20 },
  { key: 'receita-despesa', category: 'relatorios', title: 'Receita x Despesa', description: 'Resultado consolidado por empresa', href: '/receita-despesa', icon: 'fa-chart-pie', roles: ['ADMIN'], order: 10 },
  { key: 'entrada-saida', category: 'relatorios', title: 'Entrada x Saída', description: 'Movimento fiscal por empresa', href: '/entrada-saida', icon: 'fa-right-left', roles: ['ADMIN'], order: 20 },
  { key: 'markup', category: 'relatorios', title: 'Markup', description: 'Rentabilidade, custo e desconto por vendedor', href: '/markup', icon: 'fa-chart-line', roles: ['ADMIN'], order: 30 },
  { key: 'financeiro', category: 'financeiro', title: 'Acompanhamento Financeiro', description: 'Boletos e contas a pagar', href: '/acompanhamento-financeiro', icon: 'fa-file-invoice-dollar', roles: ['ADMIN'], order: 10 },
  { key: 'baixa-boletos', category: 'financeiro', title: 'Baixa de Boletos', description: 'Baixa por PDF de boleto', href: '/baixa-boletos', icon: 'fa-file-pdf', roles: ['ADMIN', 'ASS_COMPRA'], order: 20 }
];

function defaults() {
  return DEFAULT_CATEGORIES.map(category => ({ ...category, active: true, apps: [] }));
}

async function loadMenu(role, includeInactive = false) {
  let categories = defaults();
  let assignments = new Map();
  let installed = true;
  try {
    const [catResult, appResult] = await Promise.all([
      db.simpleExecute(`SELECT CODCATEGORIA, NOME, ICONE, ORDEM, ATIVO FROM AD_MENU_CATEGORIA ORDER BY ORDEM, NOME`),
      db.simpleExecute(`SELECT CHAVE_APP, CODCATEGORIA, ORDEM, ATIVO FROM AD_MENU_APLICATIVO`)
    ]);
    categories = catResult.rows.map(row => ({
      key: String(row.CODCATEGORIA), name: row.NOME, icon: row.ICONE || 'fa-folder',
      order: Number(row.ORDEM) || 0, active: row.ATIVO !== 'N', apps: []
    }));
    assignments = new Map(appResult.rows.map(row => [String(row.CHAVE_APP), {
      category: String(row.CODCATEGORIA), order: Number(row.ORDEM) || 0, active: row.ATIVO !== 'N'
    }]));
  } catch (error) {
    if (error.errorNum !== 942) throw error;
    installed = false;
  }

  const categoryMap = new Map(categories.map(category => [category.key, category]));
  for (const app of APPS) {
    if (app.roles && !app.roles.includes(role) && !includeInactive) continue;
    const assignment = assignments.get(app.key);
    if (assignment && !assignment.active && !includeInactive) continue;
    const category = categoryMap.get(assignment ? assignment.category : app.category);
    if (category) category.apps.push({
      ...app, order: assignment ? assignment.order : app.order,
      active: assignment ? assignment.active : true
    });
  }
  categories.forEach(category => category.apps.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)));
  return { installed, categories: categories.filter(category => includeInactive || category.active), apps: APPS };
}

module.exports = { DEFAULT_CATEGORIES, APPS, loadMenu };
