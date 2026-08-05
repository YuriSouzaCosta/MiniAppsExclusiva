// ========== GLOBAL STATE ==========
let currentTab = 'pendentes';

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function () {
    console.log('=== ANALISE TRANSFERENCIAS - Script carregado ===');

    // Carregar dados da aba inicial
    carregarTransferenciasPendentes();

    // Event listeners para as tabs
    setupTabListeners();
});

// ========== TAB LISTENERS ==========
function setupTabListeners() {
    const tabs = document.querySelectorAll('[data-bs-toggle="tab"]');

    tabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', function (event) {
            const targetId = event.target.getAttribute('data-bs-target').substring(1);
            currentTab = targetId;

            console.log('Tab ativa:', targetId);

            // Carregar dados baseado na tab ativa
            switch (targetId) {
                case 'pendentes':
                    carregarTransferenciasPendentes();
                    break;
                case 'finalizadas':
                    carregarTransferenciasFinalizadas();
                    break;
                case 'produto':
                    carregarAnalisePorProduto();
                    break;
                case 'local':
                    carregarAnalisePorLocal();
                    break;
                // 'periodo' é carregado apenas quando o usuário filtrar
            }
        });
    });
}

// ========== API CALLS ==========

// Carregar Transferências Pendentes
async function carregarTransferenciasPendentes() {
    const container = document.getElementById('pendentesContent');

    try {
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
            </div>
        `;

        const response = await fetch('/analise-transferencias/api/pendentes');
        const data = await response.json();

        console.log('Transferências pendentes:', data);

        if (data.length === 0) {
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
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Produto</th>
                            <th>Referência</th>
                            <th>Origem</th>
                            <th>Destino</th>
                            <th>Qtd</th>
                            <th>Data</th>
                            <th>Usuário</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach(item => {
            html += `
                <tr>
                    <td>${item.ID_TRANSFERENCIA || '-'}</td>
                    <td>${item.DESCRPROD || '-'}</td>
                    <td>${item.REFERENCIA || '-'}</td>
                    <td>${item.DESC_LOCAL_ORIGEM || '-'} (${item.EMPRESA_ORIGEM || '-'})</td>
                    <td>${item.DESC_LOCAL_DESTINO || '-'} (${item.EMPRESA_DESTINO || '-'})</td>
                    <td>${item.QUANTIDADE || 0}</td>
                    <td>${item.DATA_CRIACAO || '-'}</td>
                    <td>${item.USUARIO || '-'}</td>
                    <td><span class="badge-pendente">Pendente</span></td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Erro ao carregar transferências pendentes:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Erro ao carregar dados</p>
            </div>
        `;
    }
}

// Carregar Transferências Finalizadas
async function carregarTransferenciasFinalizadas(limit = 50, offset = 0) {
    const container = document.getElementById('finalizadasContent');

    try {
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
            </div>
        `;

        const response = await fetch(`/analise-transferencias/api/finalizadas?limit=${limit}&offset=${offset}`);
        const data = await response.json();

        console.log('Transferências finalizadas:', data);

        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <p>Nenhuma transferência finalizada encontrada</p>
                </div>
            `;
            return;
        }

        // Renderizar tabela
        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Produto</th>
                            <th>Referência</th>
                            <th>Origem</th>
                            <th>Destino</th>
                            <th>Qtd</th>
                            <th>Data Criação</th>
                            <th>Data Finalização</th>
                            <th>Usuário</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach(item => {
            html += `
                <tr>
                    <td>${item.ID_TRANSFERENCIA || '-'}</td>
                    <td>${item.DESCRPROD || '-'}</td>
                    <td>${item.REFERENCIA || '-'}</td>
                    <td>${item.DESC_LOCAL_ORIGEM || '-'} (${item.EMPRESA_ORIGEM || '-'})</td>
                    <td>${item.DESC_LOCAL_DESTINO || '-'} (${item.EMPRESA_DESTINO || '-'})</td>
                    <td>${item.QUANTIDADE || 0}</td>
                    <td>${item.DATA_CRIACAO || '-'}</td>
                    <td>${item.DATA_FINALIZACAO || '-'}</td>
                    <td>${item.USUARIO || '-'}</td>
                    <td><span class="badge-finalizada">Finalizada</span></td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Erro ao carregar transferências finalizadas:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Erro ao carregar dados</p>
            </div>
        `;
    }
}

// Filtrar por Período
async function filtrarPorPeriodo() {
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;
    const container = document.getElementById('periodoContent');

    if (!dataInicio || !dataFim) {
        Swal.fire({
            icon: 'warning',
            title: 'Atenção',
            text: 'Por favor, selecione as datas de início e fim'
        });
        return;
    }

    try {
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
            </div>
        `;

        const response = await fetch(`/analise-transferencias/api/analise-periodo?dataInicio=${dataInicio}&dataFim=${dataFim}`);
        const data = await response.json();

        console.log('Análise por período:', data);

        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <p>Nenhuma transferência encontrada neste período</p>
                </div>
            `;
            return;
        }

        // Calcular totais
        let totalTransferencias = 0;
        let totalQuantidade = 0;
        let totalPendentes = 0;
        let totalFinalizadas = 0;

        data.forEach(item => {
            totalTransferencias += parseInt(item.TOTAL_TRANSFERENCIAS || 0);
            totalQuantidade += parseInt(item.QUANTIDADE_TOTAL || 0);
            totalPendentes += parseInt(item.PENDENTES || 0);
            totalFinalizadas += parseInt(item.FINALIZADAS || 0);
        });

        // Renderizar cards de estatísticas + tabela
        let html = `
            <div class="row g-3 mb-4">
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${totalTransferencias}</div>
                        <div class="stat-label">Total Transferências</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${totalQuantidade}</div>
                        <div class="stat-label">Quantidade Total</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${totalPendentes}</div>
                        <div class="stat-label">Pendentes</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${totalFinalizadas}</div>
                        <div class="stat-label">Finalizadas</div>
                    </div>
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Total Transferências</th>
                            <th>Quantidade Total</th>
                            <th>Pendentes</th>
                            <th>Finalizadas</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach(item => {
            html += `
                <tr>
                    <td>${item.DATA || '-'}</td>
                    <td>${item.TOTAL_TRANSFERENCIAS || 0}</td>
                    <td>${item.QUANTIDADE_TOTAL || 0}</td>
                    <td>${item.PENDENTES || 0}</td>
                    <td>${item.FINALIZADAS || 0}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Erro ao filtrar por período:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Erro ao carregar dados</p>
            </div>
        `;
    }
}

// Carregar Análise por Produto
async function carregarAnalisePorProduto() {
    const container = document.getElementById('produtoContent');

    try {
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
            </div>
        `;

        const response = await fetch('/analise-transferencias/api/analise-produto');
        const data = await response.json();

        console.log('Análise por produto:', data);

        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <p>Nenhum dado encontrado</p>
                </div>
            `;
            return;
        }

        // Renderizar tabela
        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Produto</th>
                            <th>Referência</th>
                            <th>Total Transferências</th>
                            <th>Quantidade Total</th>
                            <th>Pendentes</th>
                            <th>Finalizadas</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach(item => {
            html += `
                <tr>
                    <td>${item.CODPROD || '-'}</td>
                    <td>${item.DESCRPROD || '-'}</td>
                    <td>${item.REFERENCIA || '-'}</td>
                    <td>${item.TOTAL_TRANSFERENCIAS || 0}</td>
                    <td>${item.QUANTIDADE_TOTAL || 0}</td>
                    <td>${item.PENDENTES || 0}</td>
                    <td>${item.FINALIZADAS || 0}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Erro ao carregar análise por produto:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Erro ao carregar dados</p>
            </div>
        `;
    }
}

// Carregar Análise por Local
async function carregarAnalisePorLocal() {
    const container = document.getElementById('localContent');

    try {
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
            </div>
        `;

        const response = await fetch('/analise-transferencias/api/analise-local');
        const data = await response.json();

        console.log('Análise por local:', data);

        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <p>Nenhum dado encontrado</p>
                </div>
            `;
            return;
        }

        // Renderizar tabela
        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Origem</th>
                            <th>Local Origem</th>
                            <th>Destino</th>
                            <th>Local Destino</th>
                            <th>Total Transferências</th>
                            <th>Quantidade Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach(item => {
            html += `
                <tr>
                    <td>${item.EMPRESA_ORIGEM || '-'}</td>
                    <td>${item.DESC_LOCAL_ORIGEM || '-'}</td>
                    <td>${item.EMPRESA_DESTINO || '-'}</td>
                    <td>${item.DESC_LOCAL_DESTINO || '-'}</td>
                    <td>${item.TOTAL_TRANSFERENCIAS || 0}</td>
                    <td>${item.QUANTIDADE_TOTAL || 0}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Erro ao carregar análise por local:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle"></i>
                <p>Erro ao carregar dados</p>
            </div>
        `;
    }
}
