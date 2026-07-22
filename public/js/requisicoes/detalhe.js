// Detalhe da requisição. A mesma tela serve para separar (marcando
// TEM / NÃO TEM / PARCIAL) e para o requisitante conferir o resultado.

let cabecalho = null;
let itens = [];
let modoSeparacao = false;

const ROTULOS = {
    ABERTA: 'Aberta',
    EM_SEPARACAO: 'Em separação',
    FINALIZADA: 'Finalizada',
    RECEBIDA: 'Recebida',
    CANCELADA: 'Cancelada'
};

const CLASSES = {
    ABERTA: 'aberta',
    EM_SEPARACAO: 'separacao',
    FINALIZADA: 'finalizada',
    RECEBIDA: 'recebida',
    CANCELADA: 'cancelada'
};

carregar();

async function carregar() {
    try {
        const resposta = await fetch(`/requisicoes/api/requisicoes/${NUM_REQ}`);
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Falha ao carregar');

        cabecalho = dados.cabecalho;
        itens = dados.itens;
        modoSeparacao = PODE_SEPARAR && cabecalho.STATUS === 'EM_SEPARACAO';

        desenharCabecalho();
        desenharItens();
        desenharBarra();
    } catch (err) {
        Swal.fire('Erro', err.message, 'error');
    }
}

function desenharCabecalho() {
    document.getElementById('subtitulo').textContent =
        `${cabecalho.GRUPO_REQUISITADO} → ${cabecalho.EMPRESA_DESTINO || cabecalho.CODEMP_DESTINO}`;

    const etiqueta = document.getElementById('etiquetaStatus');
    etiqueta.textContent = ROTULOS[cabecalho.STATUS] || cabecalho.STATUS;
    etiqueta.className = `req-etiqueta et-${CLASSES[cabecalho.STATUS] || 'normal'}`;

    const campos = [
        ['Requisitante', cabecalho.REQUISITANTE],
        ['Aberta em', cabecalho.DATA_INICIO],
        ['Separador', cabecalho.SEPARADOR || '—'],
        ['Separação iniciada', cabecalho.DATA_SEPARACAO || '—'],
        ['Concluída em', cabecalho.DATA_CONCLUSAO || '—'],
        ['Recebida em', cabecalho.DATA_RECEBIMENTO || '—']
    ];

    if (cabecalho.PRIORIDADE === 'URGENTE') campos.unshift(['Prioridade', 'URGENTE']);
    if (cabecalho.OBSERVACAO) campos.push(['Observação', cabecalho.OBSERVACAO]);

    document.getElementById('cabecalho').innerHTML = campos.map(([titulo, valor]) => `
        <div class="col-6 col-md-3 col-lg-2">
            <div class="text-muted small">${titulo}</div>
            <div class="fw-semibold">${valor || '—'}</div>
        </div>`).join('');
}

function desenharItens() {
    const container = document.getElementById('listaItens');

    container.innerHTML = itens.map(item => {
        const saldo = Number(item.ESTOQUE_GRUPO) || 0;
        const status = item.STATUS || '';

        const detalhes = [
            `Cód. ${item.COD_SNK}`,
            item.REFERENCIA ? `Ref. ${item.REFERENCIA}` : '',
            item.REFFORN ? `Forn. ${item.REFFORN}` : ''
        ].filter(Boolean).join(' · ');

        const origem = item.NUNOTA
            ? `<div class="sep-meta mt-2">
                   Saiu da empresa <strong>${item.CODEMP_ORIGEM}</strong>,
                   local ${item.CODLOCAL_ORIGEM} · Transferência <strong>${item.NUNOTA}</strong>
               </div>`
            : '';

        const botoes = modoSeparacao ? `
            <div class="sep-acoes">
                <button class="sep-btn ${status === 'TEM' ? 'ativo-TEM' : ''}"
                        onclick="marcar(${item.SEQUENCIA}, 'TEM')">
                    <i class="bi bi-check-lg"></i> Tem tudo
                </button>
                <button class="sep-btn ${status === 'PARCIAL' ? 'ativo-PARCIAL' : ''}"
                        onclick="marcar(${item.SEQUENCIA}, 'PARCIAL')">
                    <i class="bi bi-pie-chart"></i> Parcial
                </button>
                <button class="sep-btn ${status === 'NAO_TEM' ? 'ativo-NAO_TEM' : ''}"
                        onclick="marcar(${item.SEQUENCIA}, 'NAO_TEM')">
                    <i class="bi bi-x-lg"></i> Não tem
                </button>
            </div>
            <div class="sep-parcial ${status === 'PARCIAL' ? 'visivel' : ''}" id="parcial-${item.SEQUENCIA}">
                <label class="fw-semibold mb-0">Quantidade separada:</label>
                <input type="number" min="1" max="${item.QTD}" value="${item.QTD_PARCIAL || ''}"
                       onchange="alterarParcial(${item.SEQUENCIA}, this.value)"
                       placeholder="0">
                <span class="text-muted">de ${item.QTD}</span>
            </div>`
            : `<div class="sep-acoes">${resultadoLeitura(item)}</div>`;

        return `
            <div class="sep-item ${status ? 'marcado-' + status : ''}" id="item-${item.SEQUENCIA}">
                <div class="sep-topo">
                    <div>
                        <div class="sep-desc">${item.DESCRPROD || 'Produto ' + item.COD_SNK}</div>
                        <div class="sep-meta">${detalhes}</div>
                        <div class="sep-meta">
                            Saldo no grupo: <strong class="${saldo > 0 ? 'saldo-ok' : 'saldo-zero'}">
                            ${saldo > 0 ? saldo + ' un' : 'sem saldo'}</strong>
                        </div>
                    </div>
                    <div class="sep-qtd-pedida">${formatarQtd(item.QTD)} un</div>
                </div>
                ${botoes}
                ${origem}
            </div>`;
    }).join('');
}

function resultadoLeitura(item) {
    if (!item.STATUS) {
        return '<span class="req-etiqueta et-normal">Aguardando separação</span>';
    }
    if (item.STATUS === 'TEM') {
        return `<span class="req-etiqueta et-finalizada">Atendido — ${formatarQtd(item.QTD)} un</span>`;
    }
    if (item.STATUS === 'NAO_TEM') {
        return '<span class="req-etiqueta et-urgente">Não tem em estoque</span>';
    }
    return `<span class="req-etiqueta et-separacao">
                Parcial — ${formatarQtd(item.QTD_PARCIAL)} de ${formatarQtd(item.QTD)} un
            </span>`;
}

function formatarQtd(valor) {
    const numero = Number(valor) || 0;
    return Number.isInteger(numero) ? numero : numero.toFixed(2);
}

function marcar(sequencia, status) {
    const item = itens.find(i => i.SEQUENCIA === sequencia);
    if (!item) return;

    item.STATUS = status;
    if (status !== 'PARCIAL') item.QTD_PARCIAL = null;

    desenharItens();
    desenharBarra();

    if (status === 'PARCIAL') {
        const campo = document.querySelector(`#parcial-${sequencia} input`);
        if (campo) { campo.focus(); campo.select(); }
    }
}

function alterarParcial(sequencia, valor) {
    const item = itens.find(i => i.SEQUENCIA === sequencia);
    if (!item) return;

    let quantidade = Number(valor) || 0;
    if (quantidade > Number(item.QTD)) quantidade = Number(item.QTD);
    if (quantidade < 0) quantidade = 0;

    item.QTD_PARCIAL = quantidade;
    desenharBarra();
}

function itensPendentes() {
    return itens.filter(item => !item.STATUS ||
        (item.STATUS === 'PARCIAL' && !(Number(item.QTD_PARCIAL) > 0)));
}

function desenharBarra() {
    const barra = document.getElementById('barraAcoes');
    const resumo = document.getElementById('resumoSeparacao');
    const botoes = document.getElementById('botoesAcao');

    barra.style.display = 'flex';
    botoes.innerHTML = '';

    if (modoSeparacao) {
        const pendentes = itensPendentes().length;
        const prontos = itens.length - pendentes;

        resumo.innerHTML = `<strong>${prontos}/${itens.length}</strong> item(ns) marcado(s)` +
            (pendentes ? ` · <span class="text-danger">${pendentes} faltando</span>` : '');

        botoes.innerHTML = `
            <button class="btn btn-light border d-flex align-items-center justify-content-center gap-1"
                    onclick="salvar()">
                <i class="bi bi-save"></i>
                <span class="d-none d-sm-inline">Salvar parcial</span>
                <span class="d-sm-none">Salvar</span>
            </button>
            <button class="req-btn-principal" id="btnLiberar" ${pendentes ? 'disabled' : ''}
                    onclick="liberar()">
                <i class="bi bi-check2-circle"></i>
                <span class="d-none d-sm-inline">Finalizar separação</span>
                <span class="d-sm-none">Finalizar</span>
            </button>`;
        return;
    }

    if (PODE_SEPARAR && cabecalho.STATUS === 'ABERTA') {
        resumo.innerHTML = `<strong>${itens.length}</strong> item(ns) solicitado(s)`;
        botoes.innerHTML = `
            <button class="req-btn-principal" onclick="assumir()">
                <i class="bi bi-box-seam"></i> Iniciar separação
            </button>`;
        return;
    }

    // Qualquer usuario pode confirmar o recebimento: quem recebe na loja de
    // destino nem sempre e quem abriu a requisicao.
    if (cabecalho.STATUS === 'FINALIZADA') {
        resumo.innerHTML = 'Separação concluída — confira e confirme o recebimento';
        botoes.innerHTML = `
            <button class="req-btn-principal" onclick="receber()">
                <i class="bi bi-check2-all"></i> Confirmar recebimento
            </button>`;
        return;
    }

    if (cabecalho.STATUS === 'ABERTA' && cabecalho.REQUISITANTE === USUARIO) {
        resumo.innerHTML = `<strong>${itens.length}</strong> item(ns) aguardando separação`;
        botoes.innerHTML = `
            <button class="btn btn-outline-danger" onclick="cancelar()">
                <i class="bi bi-x-circle"></i> Cancelar requisição
            </button>`;
        return;
    }

    resumo.innerHTML = `<strong>${itens.length}</strong> item(ns)`;
}

async function assumir() {
    try {
        const resposta = await fetch(`/requisicoes/api/requisicoes/${NUM_REQ}/assumir`, { method: 'POST' });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Falha ao assumir');
        carregar();
    } catch (err) {
        Swal.fire('Não foi possível iniciar', err.message, 'warning');
    }
}

async function salvar(silencioso) {
    const corpo = {
        itens: itens.map(item => ({
            sequencia: item.SEQUENCIA,
            status: item.STATUS || null,
            qtdParcial: item.QTD_PARCIAL
        })).filter(item => item.status)
    };

    const resposta = await fetch(`/requisicoes/api/requisicoes/${NUM_REQ}/itens`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
    });

    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.error || 'Falha ao salvar');

    if (!silencioso) {
        Swal.fire({
            icon: 'success',
            title: 'Separação salva',
            timer: 1200,
            showConfirmButton: false
        });
    }
}

async function liberar() {
    if (itensPendentes().length) return;

    const confirmacao = await Swal.fire({
        title: 'Finalizar a separação?',
        text: 'As transferências serão geradas no Sankhya e o requisitante verá o resultado.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, finalizar',
        cancelButtonText: 'Voltar',
        confirmButtonColor: '#ea580c'
    });

    if (!confirmacao.isConfirmed) return;

    const botao = document.getElementById('btnLiberar');
    if (botao) botao.disabled = true;

    try {
        await salvar(true);

        const resposta = await fetch(`/requisicoes/api/requisicoes/${NUM_REQ}/liberar`, { method: 'POST' });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Falha ao liberar');

        const notas = (dados.notas || [])
            .map(nota => `Empresa ${nota.codemp}: ${nota.nunota ? 'NUNOTA ' + nota.nunota : nota.mensagem}`)
            .join('<br>');

        const avisos = (dados.avisos || []).length
            ? `<hr><div class="text-start text-danger small">${dados.avisos.join('<br>')}</div>`
            : '';

        await Swal.fire({
            icon: dados.avisos && dados.avisos.length ? 'warning' : 'success',
            title: 'Separação finalizada',
            html: `<div class="text-start">${notas || 'Nenhuma transferência gerada.'}</div>${avisos}`,
            confirmButtonColor: '#ea580c'
        });

        // Separação encerrada: volta para a fila, em vez de deixar o separador
        // parado numa tela onde a única ação seria confirmar o recebimento.
        window.location.href = '/requisicoes/separacao';
    } catch (err) {
        Swal.fire('Erro ao liberar', err.message, 'error');
        if (botao) botao.disabled = false;
    }
}

async function receber() {
    try {
        const resposta = await fetch(`/requisicoes/api/requisicoes/${NUM_REQ}/receber`, { method: 'POST' });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Falha ao confirmar');

        await Swal.fire({
            icon: 'success',
            title: 'Recebimento confirmado',
            timer: 1400,
            showConfirmButton: false
        });
        carregar();
    } catch (err) {
        Swal.fire('Erro', err.message, 'error');
    }
}

async function cancelar() {
    const confirmacao = await Swal.fire({
        title: 'Cancelar a requisição?',
        text: 'Ela sai da fila de separação e não poderá ser reaberta.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, cancelar',
        cancelButtonText: 'Voltar',
        confirmButtonColor: '#dc2626'
    });

    if (!confirmacao.isConfirmed) return;

    try {
        const resposta = await fetch(`/requisicoes/api/requisicoes/${NUM_REQ}/cancelar`, { method: 'POST' });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Falha ao cancelar');
        carregar();
    } catch (err) {
        Swal.fire('Erro', err.message, 'error');
    }
}
