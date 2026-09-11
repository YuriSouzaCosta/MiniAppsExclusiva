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
        const response = await fetch(`${apiBase}/api/criarTransferencias`, {
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

        console.log('Resultado das transferências:', resultado);

        // Verificar se houve erros
        if (resultado.erros > 0) {
            // Montar lista de erros
            const errosDetalhes = resultado.resultados
                .filter(r => r.status === 'error')
                .map(r => `• Produto ${r.codProd}: ${r.mensagem}`)
                .join('\n');

            await Swal.fire({
                icon: 'warning',
                title: 'Atenção!',
                html: `
                    <p><strong>${resultado.message}</strong></p>
                    ${resultado.sucessos > 0 ? `<p style="color: #10b981;">✓ ${resultado.sucessos} transferência(s) criada(s)</p>` : ''}
                    ${resultado.erros > 0 ? `<p style="color: #ef4444;">✗ ${resultado.erros} erro(s):</p>
                    <pre style="text-align: left; font-size: 0.875rem; background: #f3f4f6; padding: 1rem; border-radius: 8px; max-height: 200px; overflow-y: auto;">${errosDetalhes}</pre>` : ''}
                `,
                confirmButtonColor: '#10b981'
            });
        } else {
            await Swal.fire({
                icon: 'success',
                title: 'Sucesso!',
                text: resultado.message,
                confirmButtonColor: '#10b981'
            });
        }

        // Limpar lista apenas se todas foram criadas com sucesso
        if (resultado.erros === 0) {
            listaTransferencias = [];
            renderizarLista();
        } else {
            // Remover apenas as que foram criadas com sucesso
            const codigosSucesso = resultado.resultados
                .filter(r => r.status === 'success')
                .map(r => `${r.codProd}_${r.empresaOrigem}_${r.localOrigem}`);

            listaTransferencias = listaTransferencias.filter(item => {
                const codigo = `${item.codProd}_${item.empresaOrigem}_${item.codLocalOrigem}`;
                return !codigosSucesso.includes(codigo);
            });

            renderizarLista();

            if (listaTransferencias.length > 0) {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true
                });

                Toast.fire({
                    icon: 'info',
                    title: `${listaTransferencias.length} item(s) com erro permanece(m) na lista`
                });
            }
        }

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

// Puxar transferências pendentes
async function puxarTransferencias(containerId = 'transferenciasContent') {
    const container = document.getElementById(containerId);

    if (!container) {
        console.error('Container não encontrado:', containerId);
        return;
    }

    try {
        // Mostrar loading
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #a0aec0;">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
                <p style="margin-top: 1rem;">Carregando transferências...</p>
            </div>
        `;

        const response = await fetch(`${apiBase}/api/puxarTransferencias`);

        if (!response.ok) {
            throw new Error('Erro ao buscar transferências');
        }

        const transferencias = await response.json();

        console.log('Transferências encontradas:', transferencias.length);

        if (transferencias.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <p>Nenhuma transferência pendente no momento</p>
                </div>
            `;
            return;
        }

        // Renderizar tabela
        let html = `
            <div style="background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);">
                <h3 style="font-size: 1.25rem; font-weight: 700; color: #2d3748; margin-bottom: 1rem;">
                    <i class="bi bi-list-check"></i> Transferências Pendentes (${transferencias.length})
                </h3>
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Nº Nota</th>
                                <th>Cód Produto</th>
                                <th>Produto</th>
                                <th>Referência</th>
                                <th>Origem</th>
                                <th>Destino</th>
                                <th>Quantidade</th>
                                <th>Data</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        transferencias.forEach(item => {
            html += `
                <tr>
                    <td>${item.NUNOTA || '-'}</td>
                    <td>${item.CODPROD || '-'}</td>
                    <td>${item.DESCRPROD || '-'}</td>
                    <td>${item.REFERENCIA || item.CODVOL || '-'}</td>
                    <td>${item.EMPRESA_ORIGEM || '-'} - ${item.LOCAL_ORIGEM || '-'}</td>
                    <td>${item.EMPRESA_DESTINO || '-'} - ${item.LOCAL_DESTINO || '-'}</td>
                    <td style="text-align: center;">${item.QTDNEG || item.QUANTIDADE || 0}</td>
                    <td>${item.DTNEG || item.DATA_CRIACAO || '-'}</td>
                    <td>
                        <span style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); 
                                     color: white; 
                                     padding: 0.25rem 0.75rem; 
                                     border-radius: 12px; 
                                     font-size: 0.75rem; 
                                     font-weight: 600;">
                            Pendente
                        </span>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (err) {
        console.error('Erro ao puxar transferências:', err);
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color: #ef4444;"></i>
                <p style="color: #ef4444;">Erro ao carregar transferências</p>
                <button class="btn btn-primary-custom" onclick="puxarTransferencias('${containerId}')">
                    <i class="bi bi-arrow-clockwise"></i> Tentar Novamente
                </button>
            </div>
        `;

        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Não foi possível carregar as transferências pendentes'
        });
    }
}
