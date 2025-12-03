// public/js/transferencias/scriptTransferencias.js

const apiBase = window.location.port
    ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/transferencias`
    : `${window.location.protocol}//${window.location.hostname}/transferencias`;

let produtoAtual = null;
let listaTransferencias = [];
let locaisDestino = [];
let locaisOrigem = [];
let origemSelecionada = null;
let destinoSelecionado = null;

// Event listener para Enter no campo de código de barras
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('codigoBarras').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarProduto();
        }
    });

    // Event listeners para os campos de busca
    setupSearchableInput('localOrigem', 'dropdownOrigem', () => locaisOrigem, (item) => origemSelecionada = item);
    setupSearchableInput('localDestino', 'dropdownDestino', () => locaisDestino, (item) => destinoSelecionado = item);

    // Carregar locais de destino ao iniciar
    carregarLocaisDestino();

    // Fechar dropdowns ao clicar fora
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.position-relative')) {
            document.getElementById('dropdownOrigem').style.display = 'none';
            document.getElementById('dropdownDestino').style.display = 'none';
        }
    });
});

// Configurar input com busca
function setupSearchableInput(inputId, dropdownId, getDataFn, onSelectFn) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    input.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        const data = getDataFn();

        if (!data || data.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        const filtered = data.filter(item => {
            const text = `${item.RAZAOSOCIAL} - ${item.DESCRLOCAL}`.toLowerCase();
            return text.includes(searchTerm);
        });

        renderDropdown(dropdown, filtered, input, onSelectFn);
    });

    input.addEventListener('focus', function () {
        const data = getDataFn();
        if (data && data.length > 0) {
            renderDropdown(dropdown, data, input, onSelectFn);
        }
    });
}

// Renderizar dropdown
function renderDropdown(dropdown, items, input, onSelectFn) {
    dropdown.innerHTML = '';

    if (items.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'dropdown-item-custom';
        div.textContent = `${item.RAZAOSOCIAL} - ${item.DESCRLOCAL}${item.ESTOQUE ? ` (Estoque: ${item.ESTOQUE})` : ''}`;

        div.addEventListener('click', function () {
            input.value = `${item.RAZAOSOCIAL} - ${item.DESCRLOCAL}`;
            onSelectFn(item);
            dropdown.style.display = 'none';
        });

        dropdown.appendChild(div);
    });

    dropdown.style.display = 'block';
}

// Buscar produto por código de barras
async function buscarProduto() {
    const codigoBarras = document.getElementById('codigoBarras').value.trim();

    if (!codigoBarras) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Digite o código de barras'
        });
        return;
    }

    try {
        const response = await fetch(`${apiBase}/api/produto/${encodeURIComponent(codigoBarras)}`);

        if (!response.ok) {
            if (response.status === 404) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Não encontrado',
                    text: 'Produto não encontrado'
                });
                limparProduto();
                return;
            }
            throw new Error('Erro ao buscar produto');
        }

        const produto = await response.json();
        produtoAtual = produto;

        // Exibir informações do produto
        document.getElementById('prodCodigo').textContent = produto.CODPROD;
        document.getElementById('prodNome').textContent = produto.DESCRPROD;
        document.getElementById('prodCodBarra').textContent = produto.REFERENCIA;
        document.getElementById('prodRef').textContent = produto.REFFORN || '-';
        document.getElementById('produtoInfo').style.display = 'block';

        // Carregar locais de estoque
        await carregarEstoque(produto.CODPROD);

        // Mostrar seção de seleção
        document.getElementById('selecaoSection').style.display = 'block';

        // Focar no input de origem
        document.getElementById('localOrigem').focus();

    } catch (err) {
        console.error('Erro ao buscar produto:', err);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Erro ao buscar produto'
        });
    }
}

// Carregar locais de estoque do produto (origem)
async function carregarEstoque(codProd) {
    try {
        const response = await fetch(`${apiBase}/api/estoque/${codProd}`);

        if (!response.ok) {
            throw new Error('Erro ao buscar estoque');
        }

        locaisOrigem = await response.json();

        // Limpar seleção e input
        origemSelecionada = null;
        document.getElementById('localOrigem').value = '';

    } catch (err) {
        console.error('Erro ao carregar estoque:', err);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Erro ao carregar locais de estoque'
        });
    }
}

// Carregar todos os locais possíveis (destino)
async function carregarLocaisDestino() {
    try {
        const response = await fetch(`${apiBase}/api/locais-destino`);

        if (!response.ok) {
            throw new Error('Erro ao buscar locais destino');
        }

        locaisDestino = await response.json();

    } catch (err) {
        console.error('Erro ao carregar locais destino:', err);
    }
}

// Adicionar item à lista de transferências
function adicionarItem() {
    if (!produtoAtual) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Busque um produto primeiro'
        });
        return;
    }

    const quantidade = document.getElementById('quantidade').value;

    if (!origemSelecionada || !destinoSelecionado || !quantidade) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Preencha todos os campos'
        });
        return;
    }

    const qtd = parseInt(quantidade);

    // Validar quantidade
    if (qtd <= 0 || qtd > origemSelecionada.ESTOQUE) {
        Swal.fire({
            icon: 'warning',
            title: 'Quantidade inválida',
            text: `Quantidade deve ser entre 1 e ${origemSelecionada.ESTOQUE}`
        });
        return;
    }

    // Validar se origem e destino são diferentes
    if (origemSelecionada.CODEMP === destinoSelecionado.CODEMP && origemSelecionada.CODLOCAL === destinoSelecionado.CODLOCAL) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Origem e destino devem ser diferentes'
        });
        return;
    }

    // Adicionar à lista
    listaTransferencias.push({
        codProd: produtoAtual.CODPROD,
        nomeProd: produtoAtual.DESCRPROD,
        referencia: produtoAtual.REFERENCIA || produtoAtual.REFFORN || '-',
        empresaOrigem: origemSelecionada.CODEMP,
        razaoOrigem: origemSelecionada.RAZAOSOCIAL,
        codLocalOrigem: origemSelecionada.CODLOCAL,
        descrLocalOrigem: origemSelecionada.DESCRLOCAL,
        empresaDestino: destinoSelecionado.CODEMP,
        razaoDestino: destinoSelecionado.RAZAOSOCIAL,
        codLocalDestino: destinoSelecionado.CODLOCAL,
        descrLocalDestino: destinoSelecionado.DESCRLOCAL,
        quantidade: qtd
    });

    // Limpar campos
    document.getElementById('quantidade').value = '';
    document.getElementById('codigoBarras').value = '';
    document.getElementById('localOrigem').value = '';
    document.getElementById('localDestino').value = '';
    origemSelecionada = null;
    destinoSelecionado = null;
    limparProduto();

    // Renderizar lista
    renderizarLista();

    // Focar no código de barras
    document.getElementById('codigoBarras').focus();

    // Toast de sucesso
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });

    Toast.fire({
        icon: 'success',
        title: 'Item adicionado!'
    });
}

// Renderizar lista de transferências
function renderizarLista() {
    const tbody = document.getElementById('listaItens');
    const listaVazia = document.getElementById('listaVazia');
    const tabelaTransferencias = document.getElementById('tabelaTransferencias');
    const btnTransferir = document.getElementById('btnTransferir');

    if (listaTransferencias.length === 0) {
        listaVazia.style.display = 'block';
        tabelaTransferencias.style.display = 'none';
        btnTransferir.style.display = 'none';
        return;
    }

    listaVazia.style.display = 'none';
    tabelaTransferencias.style.display = 'block';
    btnTransferir.style.display = 'block';

    // Agrupar por empresa de origem
    const grupos = {};
    listaTransferencias.forEach((item, index) => {
        if (!grupos[item.empresaOrigem]) {
            grupos[item.empresaOrigem] = {
                razao: item.razaoOrigem,
                itens: []
            };
        }
        grupos[item.empresaOrigem].itens.push({ ...item, index });
    });

    // Renderizar
    tbody.innerHTML = '';
    Object.keys(grupos).forEach(empresa => {
        const grupo = grupos[empresa];

        // Linha de cabeçalho do grupo
        const trGrupo = document.createElement('tr');
        trGrupo.className = 'empresa-group';
        trGrupo.innerHTML = `
            <td colspan="6">
                <i class="bi bi-building"></i> Empresa: ${grupo.razao}
            </td>
        `;
        tbody.appendChild(trGrupo);

        // Itens do grupo
        grupo.itens.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.nomeProd}</td>
                <td>${item.referencia}</td>
                <td>${item.razaoOrigem} - ${item.descrLocalOrigem}</td>
                <td>${item.razaoDestino} - ${item.descrLocalDestino}</td>
                <td>${item.quantidade}</td>
                <td>
                    <button class="btn btn-danger btn-sm btn-remove" onclick="removerItem(${item.index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

// Remover item da lista
function removerItem(index) {
    listaTransferencias.splice(index, 1);
    renderizarLista();
}

// Transferir tudo
async function transferirTudo() {
    if (listaTransferencias.length === 0) {
        return;
    }

    const result = await Swal.fire({
        title: 'Confirmar Transferências',
        text: `Deseja criar ${listaTransferencias.length} transferência(s)?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sim, transferir!',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
        return;
    }

    try {
        const response = await fetch(`${apiBase}/api/criar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transferencias: listaTransferencias
            })
        });

        if (!response.ok) {
            throw new Error('Erro ao criar transferências');
        }

        const resultado = await response.json();

        Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: resultado.message,
            confirmButtonColor: '#10b981'
        });

        // Limpar lista
        listaTransferencias = [];
        renderizarLista();

    } catch (err) {
        console.error('Erro ao criar transferências:', err);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Erro ao criar transferências'
        });
    }
}

// Limpar informações do produto
function limparProduto() {
    produtoAtual = null;
    document.getElementById('produtoInfo').style.display = 'none';
    document.getElementById('selecaoSection').style.display = 'none';
    locaisOrigem = [];
    origemSelecionada = null;
}
