(() => {
  const CATEGORIAS = [
    { key: 'pix', label: 'PIX', icon: '⚡' },
    { key: 'cartao', label: 'Cartão', icon: '💳' },
    { key: 'deposito', label: 'Depósito', icon: '🏦' },
    { key: 'boleto', label: 'Boleto', icon: '📄' },
    { key: 'dinheiro', label: 'Dinheiro', icon: '💵' }
  ];
  let dadosAtuais = null;
  let empresaEdicao = null;

  const parseBrl = value => {
    const clean = String(value || '').replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const number = Number(clean);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  };
  const formatBrl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  const formatDecimal = value => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);

  function container() {
    let el = document.getElementById('receitaManualContainer');
    if (el) return el;
    const statement = document.querySelector('.statement');
    const receita = [...statement.querySelectorAll('.row')].find(row => row.querySelector('b')?.textContent.trim() === 'Receita');
    el = document.createElement('div');
    el.id = 'receitaManualContainer';
    el.className = 'receita-manual-card';
    statement.insertBefore(el, receita.nextSibling);
    return el;
  }

  function modal() {
    let el = document.getElementById('modalConfirmarReceita');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'modalConfirmarReceita';
    el.className = 'receita-confirm-modal';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<section class="receita-confirm-box" role="dialog" aria-modal="true" aria-labelledby="receitaConfirmTitulo">
      <header><div><span>Conferência</span><h3 id="receitaConfirmTitulo">Confirmar receita manual</h3></div><button class="receita-confirm-close" type="button" aria-label="Fechar">×</button></header>
      <p class="receita-confirm-context"></p><div class="receita-confirm-values"></div>
      <footer><button class="receita-confirm-cancel" type="button">Voltar e editar</button><button class="receita-confirm-save" type="button">Confirmar salvamento</button></footer>
    </section>`;
    document.body.appendChild(el);
    const close = () => { el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); };
    el.querySelector('.receita-confirm-close').addEventListener('click', close);
    el.querySelector('.receita-confirm-cancel').addEventListener('click', close);
    el.addEventListener('click', event => { if (event.target === el) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    return el;
  }

  function valoresFormulario() {
    return Object.fromEntries(CATEGORIAS.map(categoria => [categoria.key, parseBrl(document.getElementById(`input_receita_${categoria.key}`)?.value)]));
  }

  function atualizarTotal() {
    if (!dadosAtuais) return;
    const valores = valoresFormulario();
    const total = CATEGORIAS.reduce((sum, categoria) => sum + valores[categoria.key], 0);
    const label = document.getElementById('lblTotalManual');
    if (label) label.textContent = formatBrl(total);
    window.dispatchEvent(new CustomEvent('receitaManualMudou', { detail: { total } }));
  }

  function formulario(data, empresas) {
    const empresa = empresaEdicao || empresas[0];
    const registro = data.registros?.find(item => item.empresa === empresa);
    const valores = registro?.valores || { pix: 0, cartao: 0, deposito: 0, boleto: 0, dinheiro: 0 };
    const empresaSelect = empresas.length > 1 ? `<div class="receita-manual-empresa-select"><label for="selectEmpresaManual">Empresa para preenchimento:</label><select id="selectEmpresaManual">${empresas.map(item => `<option value="${item}" ${item === empresa ? 'selected' : ''}>Empresa ${item}</option>`).join('')}</select></div>` : '';
    return `<div class="receita-manual-header"><h3>Receita manual por categoria <span class="badge-status ${registro ? 'salvo' : 'pendente'}">${registro ? 'Salvo' : 'Pendente'}</span></h3><span class="receita-manual-total">Total mês: <strong id="lblTotalManual">${formatBrl(CATEGORIAS.reduce((sum, categoria) => sum + valores[categoria.key], 0))}</strong></span></div>
      ${empresaSelect}<div class="receita-manual-grid">${CATEGORIAS.map(categoria => `<div class="receita-input-group"><label for="input_receita_${categoria.key}">${categoria.icon} ${categoria.label}</label><div class="receita-input-wrapper"><span>R$</span><input id="input_receita_${categoria.key}" type="text" inputmode="decimal" value="${formatDecimal(valores[categoria.key])}" placeholder="0,00"></div></div>`).join('')}</div>
      <div class="receita-manual-footer"><span>Empresa ${empresa} · ${data.competencia}</span><button id="btnSalvarReceitaManual" class="btn-salvar-receita" type="button" data-versao="${registro?.versao || 0}">Salvar receita</button></div>`;
  }

  async function salvar(competencia, empresa, versao, valores) {
    const confirm = modal().querySelector('.receita-confirm-save');
    try {
      const response = await fetch('/fluxo-caixa/api/receita-manual', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ competencia, empresa, versao, valores }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.erro || 'Não foi possível salvar a receita.');
      modal().classList.remove('show');
      modal().setAttribute('aria-hidden', 'true');
      window.carregarDre?.();
    } catch (error) {
      modal().querySelector('.receita-confirm-context').textContent = error.message;
      confirm.disabled = false;
      confirm.textContent = 'Tentar novamente';
    }
  }

  function confirmar(data, empresas) {
    const empresa = empresaEdicao || empresas[0];
    const versao = Number(document.getElementById('btnSalvarReceitaManual').dataset.versao || 0);
    const valores = valoresFormulario();
    const total = CATEGORIAS.reduce((sum, categoria) => sum + valores[categoria.key], 0);
    const el = modal();
    el.querySelector('.receita-confirm-context').textContent = `Empresa ${empresa} · competência ${data.competencia}`;
    el.querySelector('.receita-confirm-values').innerHTML = CATEGORIAS.map(categoria => `<div><span>${categoria.label}</span><b>${formatBrl(valores[categoria.key])}</b></div>`).join('') + `<div class="receita-confirm-total"><span>Total da receita</span><b>${formatBrl(total)}</b></div>`;
    const confirm = el.querySelector('.receita-confirm-save');
    confirm.disabled = false;
    confirm.textContent = 'Confirmar salvamento';
    confirm.onclick = () => { confirm.disabled = true; confirm.textContent = 'Salvando…'; salvar(data.competencia, empresa, versao, valores); };
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
    confirm.focus();
  }

  function bind(data, empresas) {
    document.getElementById('selectEmpresaManual')?.addEventListener('change', event => { empresaEdicao = Number(event.target.value); render(data, empresas); });
    CATEGORIAS.forEach(categoria => {
      const input = document.getElementById(`input_receita_${categoria.key}`);
      input.addEventListener('focus', () => { if (input.value === '0,00') input.value = ''; });
      input.addEventListener('input', atualizarTotal);
      input.addEventListener('blur', () => { input.value = formatDecimal(parseBrl(input.value)); atualizarTotal(); });
    });
    document.getElementById('btnSalvarReceitaManual').addEventListener('click', () => confirmar(data, empresas));
  }

  function render(data, empresas) {
    dadosAtuais = data;
    const el = container();
    el.innerHTML = formulario(data, empresas);
    bind(data, empresas);
  }
  window.renderReceitaManual = render;
})();
