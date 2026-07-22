// Montagem da lista de produtos da requisição.
// O fluxo é pensado para leitor de código de barras: digita/bipa, Enter,
// o item entra com quantidade 1 e o foco volta para a busca.

const itens = [];
let resultadosAtuais = [];
let marcado = -1;
let debounce = null;

const campoBusca = document.getElementById('busca');
const caixaResultados = document.getElementById('resultados');
const corpoLista = document.getElementById('corpoLista');
const linhaVazia = document.getElementById('linhaVazia');
const btnEnviar = document.getElementById('btnEnviar');

campoBusca.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(buscar, 250);
});

campoBusca.addEventListener('keydown', evento => {
    if (evento.key === 'ArrowDown') {
        evento.preventDefault();
        mover(1);
    } else if (evento.key === 'ArrowUp') {
        evento.preventDefault();
        mover(-1);
    } else if (evento.key === 'Enter') {
        evento.preventDefault();
        clearTimeout(debounce);
        if (resultadosAtuais.length) {
            adicionar(resultadosAtuais[marcado >= 0 ? marcado : 0]);
        } else {
            buscar(true);
        }
    } else if (evento.key === 'Escape') {
        fecharResultados();
    }
});

// Empresas que compõem cada grupo de origem — usadas para bloquear o
// destino quando ele pertence ao próprio grupo requisitado.
const EMPRESAS_DO_GRUPO = { EXCLUSIVA: [1, 3], PRIME: [4, 2], SITE: [5, 7] };

const campoGrupo = document.getElementById('grupo');
const campoDestino = document.getElementById('codempDestino');

campoGrupo.addEventListener('change', () => {
    ajustarDestinos();
    if (campoBusca.value.trim().length >= 2) buscar();
});

function ajustarDestinos() {
    const doGrupo = EMPRESAS_DO_GRUPO[campoGrupo.value] || [];
    let selecionadoInvalido = false;

    Array.from(campoDestino.options).forEach(opcao => {
        const invalido = doGrupo.includes(Number(opcao.value));
        opcao.disabled = invalido;
        opcao.textContent = opcao.textContent.replace(' (é a origem)', '');
        if (invalido) {
            opcao.textContent += ' (é a origem)';
            if (opcao.selected) selecionadoInvalido = true;
        }
    });

    if (selecionadoInvalido) {
        const valida = Array.from(campoDestino.options).find(o => !o.disabled);
        if (valida) valida.selected = true;
    }
}

ajustarDestinos();

async function buscar(adicionarSeUnico) {
    const termo = campoBusca.value.trim();
    if (termo.length < 2) {
        fecharResultados();
        return;
    }

    const grupo = document.getElementById('grupo').value;

    try {
        const resposta = await fetch(
            `/requisicoes/api/produtos?term=${encodeURIComponent(termo)}&grupo=${grupo}`
        );
        resultadosAtuais = await resposta.json();
    } catch (err) {
        console.error(err);
        return;
    }

    // Leitor de código de barras: um único resultado entra direto.
    if (adicionarSeUnico && resultadosAtuais.length === 1) {
        adicionar(resultadosAtuais[0]);
        return;
    }

    desenharResultados();
}

function desenharResultados() {
    marcado = -1;

    if (!resultadosAtuais.length) {
        caixaResultados.innerHTML =
            '<div class="req-resultado text-muted">Nenhum produto ativo encontrado</div>';
        caixaResultados.classList.remove('d-none');
        return;
    }

    caixaResultados.innerHTML = resultadosAtuais.map((produto, indice) => {
        const saldo = Number(produto.ESTOQUE_GRUPO) || 0;
        return `
            <div class="req-resultado" data-indice="${indice}">
                <div>
                    <div class="desc">${produto.DESCRPROD || ''}</div>
                    <div class="meta">
                        Cód. ${produto.CODPROD}
                        ${produto.REFERENCIA ? ' · Ref. ' + produto.REFERENCIA : ''}
                        ${produto.REFFORN ? ' · Forn. ' + produto.REFFORN : ''}
                        ${produto.MARCA ? ' · ' + produto.MARCA : ''}
                    </div>
                </div>
                <div class="saldo ${saldo > 0 ? 'saldo-ok' : 'saldo-zero'}">
                    ${saldo > 0 ? saldo + ' un' : 'sem saldo'}
                </div>
            </div>`;
    }).join('');

    caixaResultados.querySelectorAll('.req-resultado[data-indice]').forEach(elemento => {
        elemento.addEventListener('click', () => {
            adicionar(resultadosAtuais[Number(elemento.dataset.indice)]);
        });
    });

    caixaResultados.classList.remove('d-none');
}

function mover(passo) {
    if (!resultadosAtuais.length) return;
    marcado = (marcado + passo + resultadosAtuais.length) % resultadosAtuais.length;
    caixaResultados.querySelectorAll('.req-resultado').forEach((elemento, indice) => {
        elemento.classList.toggle('marcado', indice === marcado);
        if (indice === marcado) elemento.scrollIntoView({ block: 'nearest' });
    });
}

function fecharResultados() {
    caixaResultados.classList.add('d-none');
    resultadosAtuais = [];
    marcado = -1;
}

// Produto repetido soma na quantidade em vez de duplicar a linha.
function adicionar(produto) {
    if (!produto) return;

    const existente = itens.find(item => item.CODPROD === produto.CODPROD);
    if (existente) {
        existente.qtd += 1;
    } else {
        itens.push(Object.assign({}, produto, { qtd: 1 }));
    }

    campoBusca.value = '';
    fecharResultados();
    campoBusca.focus();
    desenharLista();
}

function remover(codprod) {
    const indice = itens.findIndex(item => item.CODPROD === codprod);
    if (indice >= 0) itens.splice(indice, 1);
    desenharLista();
    campoBusca.focus();
}

function alterarQtd(codprod, valor) {
    const item = itens.find(i => i.CODPROD === codprod);
    if (item) item.qtd = Math.max(1, Number(valor) || 1);
    atualizarRodape();
}

function desenharLista() {
    linhaVazia.style.display = itens.length ? 'none' : '';

    corpoLista.querySelectorAll('tr[data-produto]').forEach(linha => linha.remove());

    itens.forEach(item => {
        const saldo = Number(item.ESTOQUE_GRUPO) || 0;
        const linha = document.createElement('tr');
        linha.dataset.produto = item.CODPROD;
        linha.innerHTML = `
            <td><strong>${item.CODPROD}</strong></td>
            <td>
                ${item.DESCRPROD || ''}
                ${item.MARCA ? `<div class="text-muted small">${item.MARCA}</div>` : ''}
            </td>
            <td class="text-muted">${item.REFERENCIA || '-'}</td>
            <td class="${saldo > 0 ? 'saldo-ok' : 'saldo-zero'} fw-semibold">
                ${saldo > 0 ? saldo + ' un' : 'sem saldo'}
            </td>
            <td>
                <input type="number" min="1" class="req-qtd-input" value="${item.qtd}"
                    onchange="alterarQtd(${item.CODPROD}, this.value)">
            </td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="remover(${item.CODPROD})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>`;
        corpoLista.appendChild(linha);
    });

    atualizarRodape();
}

function atualizarRodape() {
    document.getElementById('totalItens').textContent = itens.length;
    btnEnviar.disabled = itens.length === 0;
}

btnEnviar.addEventListener('click', async () => {
    if (!itens.length) return;

    btnEnviar.disabled = true;

    const corpo = {
        grupo: document.getElementById('grupo').value,
        codempDestino: document.getElementById('codempDestino').value,
        prioridade: document.getElementById('prioridade').value,
        observacao: document.getElementById('observacao').value,
        itens: itens.map(item => ({ codprod: item.CODPROD, qtd: item.qtd }))
    };

    try {
        const resposta = await fetch('/requisicoes/api/requisicoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo)
        });

        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Falha ao enviar');

        await Swal.fire({
            icon: 'success',
            title: `Requisição #${dados.numReq} enviada`,
            text: `${dados.itens} produto(s) solicitado(s) ao grupo ${corpo.grupo}.`,
            confirmButtonColor: '#ea580c'
        });

        window.location.href = '/requisicoes';
    } catch (err) {
        Swal.fire('Erro', err.message, 'error');
        btnEnviar.disabled = false;
    }
});

document.addEventListener('click', evento => {
    if (!evento.target.closest('.req-busca')) fecharResultados();
});
