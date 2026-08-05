// Lista de requisições — usada tanto em "Minhas requisições" quanto na
// fila de separação. A única diferença é o escopo enviado à API.

let listaConfig = { escopo: 'minhas', statusInicial: '' };
let statusAtivo = '';

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

function iniciarLista(config) {
    listaConfig = Object.assign(listaConfig, config || {});
    statusAtivo = listaConfig.statusInicial || '';

    document.querySelectorAll('.req-aba').forEach(aba => {
        aba.addEventListener('click', () => {
            document.querySelectorAll('.req-aba').forEach(a => a.classList.remove('ativa'));
            aba.classList.add('ativa');
            statusAtivo = aba.dataset.status;
            desenharLista();
        });
    });

    carregarLista();
}

let cacheRequisicoes = [];

async function carregarLista() {
    try {
        const resposta = await fetch(`/requisicoes/api/requisicoes?escopo=${listaConfig.escopo}`);
        if (!resposta.ok) {
            const erro = await resposta.json().catch(() => ({}));
            throw new Error(erro.error || 'Falha ao carregar');
        }
        cacheRequisicoes = await resposta.json();
        desenharLista();
    } catch (err) {
        Swal.fire('Erro', err.message, 'error');
    }
}

function desenharLista() {
    const lista = document.getElementById('lista');
    const vazio = document.getElementById('vazio');

    atualizarContadores();

    const filtradas = statusAtivo
        ? cacheRequisicoes.filter(r => r.STATUS === statusAtivo)
        : cacheRequisicoes;

    lista.innerHTML = '';
    vazio.classList.toggle('d-none', filtradas.length > 0);

    filtradas.forEach(req => {
        const progresso = req.TOTAL_ITENS > 0
            ? Math.round((req.ITENS_SEPARADOS / req.TOTAL_ITENS) * 100)
            : 0;

        const card = document.createElement('div');
        card.className = `req-card ${CLASSES[req.STATUS] || ''}` +
            (req.PRIORIDADE === 'URGENTE' ? ' urgente' : '');
        card.onclick = () => { window.location.href = `/requisicoes/${req.NUM_REQ}`; };

        card.innerHTML = `
            <div class="req-card-topo">
                <span class="req-numero">#${req.NUM_REQ}</span>
                <span class="req-etiqueta et-${(CLASSES[req.STATUS] || 'normal')}">
                    ${ROTULOS[req.STATUS] || req.STATUS}
                </span>
            </div>
            ${req.PRIORIDADE === 'URGENTE'
                ? '<span class="req-etiqueta et-urgente mb-2 d-inline-block">Urgente</span>'
                : ''}
            <div class="req-linha"><span>Grupo</span><strong>${req.GRUPO_REQUISITADO}</strong></div>
            <div class="req-linha"><span>Destino</span><strong>${req.EMPRESA_DESTINO || req.CODEMP_DESTINO}</strong></div>
            <div class="req-linha"><span>Requisitante</span><strong>${req.REQUISITANTE}</strong></div>
            ${req.SEPARADOR ? `<div class="req-linha"><span>Separador</span><strong>${req.SEPARADOR}</strong></div>` : ''}
            <div class="req-linha"><span>Aberta em</span><span>${req.DATA_INICIO || '-'}</span></div>
            <div class="req-linha"><span>Itens</span><strong>${req.ITENS_SEPARADOS}/${req.TOTAL_ITENS}</strong></div>
            <div class="req-progresso"><div style="width:${progresso}%"></div></div>
        `;

        lista.appendChild(card);
    });
}

function atualizarContadores() {
    document.querySelectorAll('.req-aba').forEach(aba => {
        const status = aba.dataset.status;
        const total = status
            ? cacheRequisicoes.filter(r => r.STATUS === status).length
            : cacheRequisicoes.length;
        const contador = aba.querySelector('.contador');
        if (contador) contador.textContent = total;
    });
}
