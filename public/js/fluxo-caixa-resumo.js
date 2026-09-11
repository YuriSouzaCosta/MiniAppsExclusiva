// Uma resposta alimenta todas as linhas, subtotais e indicadores do Fluxo de Caixa.
let ultimosDadosFluxoCaixa = null;

function calcularDre(data) {
  const valor = key => Math.round((Number(data[key]) || 0) * 100);
  const operacionais = ['pessoal', 'utilidades', 'aluguel', 'taxas', 'marketing', 'administrativas', 'terceiros'];
  const despesas = operacionais.reduce((total, key) => total + valor(key), 0);
  const margem = valor('receitaLiquida') - valor('custosVariaveis');
  const bruto = margem - despesas;
  return {
    despesasOperacionais: despesas / 100,
    margemBruta: margem / 100,
    lucroBruto: bruto / 100,
    lucroLiquido: (bruto - valor('financeiras') - valor('proLabore')) / 100,
    deducoes: (valor('impostos') + valor('comissoes')) / 100
  };
}

function atualizarTelaFluxoCaixa(data) {
  ultimosDadosFluxoCaixa = data;
  const total = calcularDre(data);
  const base = Number(data.receitaBruta) || 0;
  const valores = {
    'Receita Bruta': base,
    'Receita': base,
    'Deduções da Receita': total.deducoes,
    'Impostos sobre vendas': data.impostos,
    'Comissões sobre vendas': data.comissoes,
    'Receita após deduções': data.receitaLiquida,
    'Custos Variáveis': data.custosVariaveis,
    'Margem Bruta': total.margemBruta,
    'Despesas Operacionais': total.despesasOperacionais,
    'Gastos com Pessoal': data.pessoal,
    'Utilidades e Serviços': data.utilidades,
    'Aluguel': data.aluguel,
    'Taxas e Contribuições': data.taxas,
    'Marketing': data.marketing,
    'Despesas Administrativas': data.administrativas,
    'Serviços de Terceiros': data.terceiros,
    'Lucro Bruto': total.lucroBruto,
    'Despesas Financeiras': data.financeiras,
    'Pró-labore': data.proLabore,
    'Lucro Líquido': total.lucroLiquido
  };

  const linhas = [...document.querySelectorAll('.statement .row')];
  for (const [label, raw] of Object.entries(valores)) {
    const row = linhas.find(item => item.textContent.includes(label));
    if (!row) continue;
    const value = Number(raw) || 0;
    const moneyEl = row.querySelector('.money');
    const percentEl = row.querySelector('.percent');
    if (moneyEl) moneyEl.textContent = brl.format(value);
    if (percentEl) percentEl.textContent = pct.format(base ? value / base * 100 : 0) + '%';
  }

  const cards = document.querySelectorAll('.kpi strong');
  if (cards.length >= 4) {
    cards[0].textContent = brl.format(base);
    cards[1].textContent = brl.format(total.lucroBruto);
    cards[2].textContent = brl.format(total.lucroLiquido);
    cards[3].textContent = pct.format(base ? total.lucroLiquido / base * 100 : 0) + '%';
  }
}

async function carregarDre() {
  gerar.disabled = true;
  const status = document.getElementById('dataStatus');
  status.textContent = 'Consultando o Fluxo de Caixa no Oracle…';
  try {
    const params = new URLSearchParams({
      competencia: document.getElementById('competencia').value,
      empresas: escopo.value
    });
    const response = await fetch('/fluxo-caixa/api/resumo?' + params);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.erro || 'Falha ao consultar o Fluxo de Caixa.');

    atualizarTelaFluxoCaixa(data);

    if (data.receitaManual && typeof window.renderReceitaManual === 'function') {
      window.renderReceitaManual(data.receitaManual, data.empresas);
    }

    status.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    gerar.disabled = false;
  }
}

window.addEventListener('receitaManualMudou', (e) => {
  if (!ultimosDadosFluxoCaixa) return;
  const novoTotalManual = e.detail?.total || 0;
  const dataAtualizada = {
    ...ultimosDadosFluxoCaixa,
    receita: novoTotalManual,
    receitaBruta: novoTotalManual,
    receitaLiquida: novoTotalManual - (ultimosDadosFluxoCaixa.impostos || 0) - (ultimosDadosFluxoCaixa.comissoes || 0)
  };
  atualizarTelaFluxoCaixa(dataAtualizada);
});

if (typeof module !== 'undefined') module.exports = { calcularDre };
