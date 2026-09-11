(() => {
  const statement = document.querySelector('.statement');
  const modal = document.getElementById('detailModal');
  const body = document.getElementById('detailBody');
  const title = document.getElementById('detailTitle');
  const subtitle = document.getElementById('detailSubtitle');
  const categories = {
    'Impostos sobre vendas': 'impostos', 'Comissões sobre vendas': 'comissoes',
    'Custos Variáveis': 'custos_variaveis', 'Gastos com Pessoal': 'pessoal',
    'Utilidades e Serviços': 'utilidades', 'Aluguel': 'aluguel',
    'Taxas e Contribuições': 'taxas', 'Marketing': 'marketing',
    'Despesas Administrativas': 'administrativas', 'Serviços de Terceiros': 'terceiros',
    'Despesas Financeiras': 'financeiras', 'Pró-labore': 'pro_labore'
  };
  let mode = 'parceiro', request = 0, filters, label;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const control = document.createElement('div');
  control.className = 'detail-switch';
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', 'Agrupar por');
  control.innerHTML = '<span>Ver por</span><button type="button" data-mode="parceiro">Parceiros</button><button type="button" data-mode="natureza">Naturezas</button>';
  body.before(control);
  control.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    show();
  }));

  async function show(selected) {
    const current = ++request;
    const rootMode = mode;
    const grouping = selected ? (rootMode === 'natureza' ? 'parceiro' : 'natureza') : rootMode;
    const plural = grouping === 'natureza' ? 'naturezas' : 'parceiros';
    const rootPlural = rootMode === 'natureza' ? 'naturezas' : 'parceiros';
    control.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === rootMode)));
    title.textContent = selected ? `${label} · ${selected.name}` : label;
    subtitle.textContent = `Valores agrupados por ${grouping}`;
    body.innerHTML = '<div class="detail-empty">Consultando o financeiro…</div>';
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    const params = new URLSearchParams({ ...filters, agrupar: grouping });
    if (selected) params.set(rootMode, selected.code);
    const back = selected ? `<button type="button" class="natureza-back">← Voltar a ${rootPlural}</button>` : '';
    try {
      const response = await fetch('/dre/api/detalhes?' + params, { cache: 'no-store' });
      const data = await response.json();
      if (current !== request || modal.getAttribute('aria-hidden') === 'true') return;
      if (!response.ok || !data?.ok) throw new Error(data?.erro || 'Falha no detalhamento.');
      const items = data[plural];
      if (!Array.isArray(items)) throw new Error('O servidor não retornou o detalhamento solicitado. Atualize e reinicie a aplicação e recarregue a página.');
      subtitle.textContent = `${items.length} ${plural} · total ${brl.format(data.total)}`;
      body.innerHTML = back + (items.length ? items.map((item, index) => {
        const code = grouping === 'natureza' ? item.codnat : item.codparc;
        const name = grouping === 'natureza' ? item.natureza : item.parceiro;
        const content = `<span><b>${escapeHtml(code)} — ${escapeHtml(name)}</b><small>${item.titulos} título(s)${selected ? '' : ` · Ver ${grouping === 'natureza' ? 'parceiros' : 'naturezas'} →`}</small></span><b>${brl.format(item.valor)}</b>`;
        return selected ? `<div class="partner-row">${content}</div>` :
          `<button type="button" class="partner-row natureza-item" data-index="${index}">${content}</button>`;
      }).join('') : '<div class="detail-empty">Nenhum valor encontrado no período.</div>');
      body.querySelectorAll('.natureza-item').forEach(button => button.addEventListener('click', () => {
        const item = items[Number(button.dataset.index)];
        show({ code: grouping === 'natureza' ? item.codnat : item.codparc,
          name: grouping === 'natureza' ? item.natureza : item.parceiro });
      }));
    } catch (error) {
      if (current !== request || modal.getAttribute('aria-hidden') === 'true') return;
      body.innerHTML = back + `<div class="detail-empty">${escapeHtml(error.message)}</div>`;
    }
    body.querySelector('.natureza-back')?.addEventListener('click', () => show());
  }
  const rows = new Map();
  statement.querySelectorAll('.row').forEach(row => {
    const name = Object.keys(categories).find(name => row.textContent.includes(name));
    if (!name) return;
    rows.set(row, name);
    row.classList.add('child', 'detail-groupable');
    row.querySelector('span')?.classList.add('label');
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
  });
  // Intercepta os handlers individuais herdados da DRE para abrir uma única consulta.
  function open(event) {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    const row = event.target.closest('.row');
    if (!rows.has(row)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    label = rows.get(row);
    filters = { competencia: document.getElementById('competencia').value,
      empresas: document.getElementById('escopo').value, categoria: categories[label] };
    show();
  }
  statement.addEventListener('click', open, true);
  statement.addEventListener('keydown', open, true);
})();
