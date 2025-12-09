// public/js/transferencias/scriptTransferencias.js

const apiBase = window.location.port
    ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/transferencias`
    : `${window.location.protocol}//${window.location.hostname}/transferencias`;

let produtoAtual = null;
let listaTransferencias = [];
let locaisDestino = [];

// Event listener para Enter no campo de código de barras
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('codigoBarras').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarProduto();
        }
    });

    // Carregar locais de destino ao iniciar
    carregarLocaisDestino();
});

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
        document.getElementById('prodReferencia').textContent = produto.REFERENCIA || produto.REFFORN || '-';
        document.getElementById('produtoInfo').style.display = 'block';

        // Carregar locais de estoque
        await carregarEstoque(produto.CODPROD);

        // Mostrar seção de seleção
        document.getElementById('selecaoSection').style.display = 'block';

        // Focar no select de origem
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

        const estoques = await response.json();
        const selectOrigem = document.getElementById('localOrigem');

        // Limpar select
        selectOrigem.innerHTML = '<option value="">Selecione o local de origem</option>';

        // Adicionar opções
        estoques.forEach(estoque => {
            const option = document.createElement('option');
            option.value = JSON.stringify({
                codemp: estoque.CODEMP,
                razaosocial: estoque.RAZAOSOCIAL,
                estoque: estoque.ESTOQUE
            });
            option.textContent = `${estoque.RAZAOSOCIAL} (Estoque: ${estoque.ESTOQUE})`;
            selectOrigem.appendChild(option);
        });

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
        const selectDestino = document.getElementById('localDestino');

        // Limpar select
        selectDestino.innerHTML = '<option value="">Selecione o local de destino</option>';

        // Adicionar opções
        locaisDestino.forEach(local => {
            const option = document.createElement('option');
            option.value = JSON.stringify({
                codemp: local.CODEMP,
                razaosocial: local.RAZAOSOCIAL
            });
            option.textContent = local.RAZAOSOCIAL;
            selectDestino.appendChild(option);
        });

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

    const selectOrigem = document.getElementById('localOrigem');
    const selectDestino = document.getElementById('localDestino');
    const quantidade = document.getElementById('quantidade').value;

    if (!selectOrigem.value || !selectDestino.value || !quantidade) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Preencha todos os campos'
        });
        return;
    }

    const origem = JSON.parse(selectOrigem.value);
    const destino = JSON.parse(selectDestino.value);
    const qtd = parseInt(quantidade);

    // Validar quantidade
    if (qtd <= 0 || qtd > origem.estoque) {
        Swal.fire({
            icon: 'warning',
            title: 'Quantidade inválida',
            text: `Quantidade deve ser entre 1 e ${origem.estoque}`
        });
        return;
    }

    // Validar se origem e destino são diferentes
    if (origem.codemp === destino.codemp) {
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
        empresaOrigem: origem.codemp,
        razaoOrigem: origem.razaosocial,
        localOrigem: origem.codemp, // Ajustar se tiver local específico
        empresaDestino: destino.codemp,
        razaoDestino: destino.razaosocial,
        localDestino: destino.codemp, // Ajustar se tiver local específico
        quantidade: qtd
    });

    // Limpar campos
    document.getElementById('quantidade').value = '';
    document.getElementById('codigoBarras').value = '';
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
                <td>${item.razaoOrigem}</td>
                <td>${item.razaoDestino}</td>
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
    document.getElementById('localOrigem').innerHTML = '<option value="">Selecione o local de origem</option>';
}
