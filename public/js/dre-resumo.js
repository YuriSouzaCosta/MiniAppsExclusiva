// Uma resposta alimenta todas as linhas, subtotais e indicadores da DRE.
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

async function carregarDre() {
  gerar.disabled = true;
  const status = document.getElementById('dataStatus');
  status.textContent = 'Consultando a DRE no Oracle…';
  try {
    const params = new URLSearchParams({
      competencia: document.getElementById('competencia').value,
      empresas: escopo.value
    });
    const response = await fetch('/dre/api/resumo?' + params);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.erro || 'Falha ao consultar a DRE.');
    const total = calcularDre(data);
    const base = Number(data.receitaBruta) || 0;
    const valores = {
      'Receita Bruta': base,
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
      row.querySelector('.money').textContent = brl.format(value);
      row.querySelector('.percent').textContent = pct.format(base ? value / base * 100 : 0) + '%';
    }
    const cards = document.querySelectorAll('.kpi strong');
    cards[0].textContent = brl.format(base);
    cards[1].textContent = brl.format(total.lucroBruto);
    cards[2].textContent = brl.format(total.lucroLiquido);
    cards[3].textContent = pct.format(base ? total.lucroLiquido / base * 100 : 0) + '%';
    status.textContent = `${data.notas} notas · atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    gerar.disabled = false;
  }
}

if (typeof module !== 'undefined') module.exports = { calcularDre };
