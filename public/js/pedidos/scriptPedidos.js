const apiBase = window.location.port
    ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}`
    : `${window.location.protocol}//${window.location.hostname}`;


// Global variables
let marcasDisponiveis = []; // Variável para armazenar todas as marcas
let pagDisponiveis = []; // Variável para armazenar todas as formas de pagamento
let fornDisponiveis = []; // Variável para armazenar todos os fornecedores
let marcasCarregadas = false;
let fornecedoresCarregados = false;
let pagamentosCarregados = false;


// Document ready event - Load data and initialize page-specific functions
document.addEventListener("DOMContentLoaded", function () {
    // Load all data sources
    carregarMarcas();
    carregarFornecedores();
    carregarFormasPagamento();

    // Initialize page-specific functionality
    initializePage();
});

// Initialize page based on current URL
function initializePage() {
    // Note: listaPedidos.ejs has its own carregarPedidos() implementation in the view
    // so we don't call it here to avoid duplicate loading

    if (window.location.pathname === "/finalizarPedidos") {
        carregaPedidosFeitos();
    }

}

// Function to load brands
async function carregarMarcas() {
    try {
        const response = await fetch(`${apiBase}/carregarMarcas`);

        if (!response.ok) {
            throw new Error(`Erro ao carregar marcas: ${response.status}`);
        }

        const data = await response.json();
        marcasDisponiveis = data.map(item => item.DESCRICAO);
        marcasCarregadas = true;
        console.log("Marcas carregadas:", marcasDisponiveis.length);
    } catch (error) {
        console.error("Erro ao buscar marcas:", error);
    }
}
// Function to load suppliers
async function carregarFornecedores() {
    try {
        const response = await fetch(`${apiBase}/carregarFornecedores`);

        if (!response.ok) {
            throw new Error(`Erro ao carregar fornecedores: ${response.status}`);
        }

        const data = await response.json();

        fornDisponiveis = data.map(({ CODPARC, CGC_CPF, RAZAOSOCIAL, NOMEPARC }) =>
            ({ "CODPARC": CODPARC, "CNPJ": CGC_CPF, "NOME": RAZAOSOCIAL, "PARCEIRO": NOMEPARC })
        );

        fornecedoresCarregados = true;
        console.log("Fornecedores carregados:", fornDisponiveis.length);
    } catch (error) {
        console.error("Erro ao buscar fornecedores:", error);
    }
}
// Function to load payment methods
async function carregarFormasPagamento() {
    try {
        const response = await fetch(`${apiBase}/carregarFormaPagamentos`);

        if (!response.ok) {
            throw new Error(`Erro ao carregar formas de pagamento: ${response.status}`);
        }

        const data = await response.json();

        pagDisponiveis = data.map(({ CODTIPVENDA, DESCRTIPVENDA }) =>
            ({ "CODTIPVENDA": CODTIPVENDA, "DESCRTIPVENDA": DESCRTIPVENDA })
        );

        pagamentosCarregados = true;
        console.log("Formas de pagamento carregadas:", pagDisponiveis.length);
    } catch (error) {
        console.error("Erro ao buscar formas de pagamento:", error);
    }
}



// 🔹 Filtra a lista de marcas enquanto o usuário digita
function filtrarMarcas() {
    let input = document.getElementById("marca");
    let dropdown = document.getElementById("marcaLista");

    if (!input || !dropdown) {
        return;
    }

    let valorDigitado = input.value.trim().toLowerCase();

    // Limpa o dropdown antes de recriar as opções
    dropdown.innerHTML = "";

    if (valorDigitado.length === 0) {
        dropdown.classList.remove("show");
        return;
    }

    if (!marcasCarregadas || !marcasDisponiveis || marcasDisponiveis.length === 0) {
        let loadingItem = document.createElement("a");
        loadingItem.className = "dropdown-item disabled";
        loadingItem.href = "#";
        loadingItem.textContent = "Carregando marcas...";
        dropdown.appendChild(loadingItem);
        dropdown.classList.add("show");
        return;
    }

    // Filtra localmente a lista de marcas
    let filtradas = marcasDisponiveis.filter(marca =>
        marca.toLowerCase().includes(valorDigitado)
    );

    if (filtradas.length === 0) {
        dropdown.classList.remove("show");
        return;
    }

    filtradas.forEach(marca => {
        let item = document.createElement("a");
        item.className = "dropdown-item";
        item.href = "#";
        item.textContent = marca;
        item.onclick = function (event) {
            event.preventDefault();
            input.value = marca;
            dropdown.classList.remove("show");
        };
        dropdown.appendChild(item);
    });

    dropdown.classList.add("show");
}


function filtrarFornecedor(inputId, dropdownId) {
    console.log(fornDisponiveis);

    const input = document.getElementById(inputId || "fornecedor");
    const dropdown = document.getElementById(dropdownId || "fornecedorLista");

    if (!input || !dropdown) {
        console.warn(`Elements not found: input=${inputId}, dropdown=${dropdownId}`);
        return;
    }

    let valorDigitado = input.value.trim().toLowerCase();


    // Limpa o dropdown antes de recriar as opções
    dropdown.innerHTML = "";


    // Check if suppliers are loaded
    if (!fornecedoresCarregados || !fornDisponiveis || fornDisponiveis.length === 0) {
        console.warn("Fornecedores ainda não foram carregados");

        // Add a loading indicator to the dropdown
        let loadingItem = document.createElement("a");
        loadingItem.className = "dropdown-item disabled";
        loadingItem.href = "#";
        loadingItem.textContent = "Carregando fornecedores...";
        dropdown.appendChild(loadingItem);
        dropdown.classList.add("show");
        dropdown.style.display = 'block';
        return;
    }

    // Filtra localmente a lista de FORNECEDORES (ou mostra todos se vazio)
    let filtradasForne = valorDigitado.length === 0
        ? fornDisponiveis
        : fornDisponiveis.filter(dado =>
            (dado.NOME && dado.NOME.toLowerCase().includes(valorDigitado)) ||
            (dado.PARCEIRO && dado.PARCEIRO.toLowerCase().includes(valorDigitado)) ||
            (dado.CNPJ && dado.CNPJ.toLowerCase().includes(valorDigitado))
        );

    if (filtradasForne.length === 0) {
        dropdown.classList.remove("show");
        dropdown.style.display = 'none';
        return;
    }

    filtradasForne.forEach(dado => {
        let item = document.createElement("a");
        item.className = "dropdown-item";
        item.href = "#";
        item.textContent = `${dado.NOME || ''} (${dado.CNPJ || ''})`;
        item.onclick = function (event) {
            event.preventDefault();
            input.value = dado.NOME || '';
            input.dataset.codparc = dado.CODPARC; // Store the supplier code as data attribute
            dropdown.classList.remove("show");
            dropdown.style.display = 'none';
        };
        dropdown.appendChild(item);
    });

    dropdown.classList.add("show");
    dropdown.style.display = 'block';
}

// 🔹 Filtra a lista de formas de pagamento enquanto o usuário digita
function filtrarFormaPagamento(inputId, dropdownId) {
    const input = document.getElementById(inputId || "formaPag");
    const dropdown = document.getElementById(dropdownId || "pagLista");

    if (!input || !dropdown) {
        console.warn(`Elements not found: input=${inputId}, dropdown=${dropdownId}`);
        return;
    }

    let valorDigitado = input.value.trim().toLowerCase();

    // Limpa o dropdown antes de recriar as opções
    dropdown.innerHTML = "";

    // Check if payment methods are loaded
    if (!pagamentosCarregados || !pagDisponiveis || pagDisponiveis.length === 0) {
        console.warn("Formas de pagamento ainda não foram carregadas");

        // Add a loading indicator to the dropdown
        let loadingItem = document.createElement("a");
        loadingItem.className = "dropdown-item disabled";
        loadingItem.href = "#";
        loadingItem.textContent = "Carregando formas de pagamento...";
        dropdown.appendChild(loadingItem);
        dropdown.classList.add("show");
        dropdown.style.display = 'block';
        return;
    }

    // Filtra localmente a lista de formas de pagamento (ou mostra todas se vazio)
    let filtradasPag = valorDigitado.length === 0
        ? pagDisponiveis
        : pagDisponiveis.filter(dado =>
            dado.DESCRTIPVENDA && dado.DESCRTIPVENDA.toLowerCase().includes(valorDigitado)
        );

    if (filtradasPag.length === 0) {
        dropdown.classList.remove("show");
        dropdown.style.display = 'none';
        return;
    }

    filtradasPag.forEach(dado => {
        let item = document.createElement("a");
        item.className = "dropdown-item";
        item.href = "#";
        item.textContent = dado.DESCRTIPVENDA || '';
        item.onclick = function (event) {
            event.preventDefault();
            input.value = dado.DESCRTIPVENDA || '';
            input.dataset.codtipvenda = dado.CODTIPVENDA;
            dropdown.classList.remove("show");
            dropdown.style.display = 'none';
        };
        dropdown.appendChild(item);
    });

    dropdown.classList.add("show");
    dropdown.style.display = 'block';
}

document.addEventListener("click", function (event) {
    // Get all dropdown elements on the page
    const dropdowns = document.querySelectorAll(".dropdown-menu.show");

    dropdowns.forEach(dropdown => {
        // Find the corresponding input (remove 'Lista' from the ID)
        const inputId = dropdown.id.replace('Lista', '');
        const input = document.getElementById(inputId);

        if (input && dropdown) {
            if (!input.contains(event.target) && !dropdown.contains(event.target)) {
                dropdown.classList.remove("show");
            }
        }
    });
});

async function salvaPedido() {
    try {
        // Define a URL da API
        const apiUrl = `${apiBase}/criarPedido`; // Altere para o endpoint correto

        // Configura os dados que serão enviados para a API
        const requestData = {
            marca: document.getElementById("marca").value,
            dtInit: document.getElementById("dtInit").value,
            dtEnd: document.getElementById("dtEnd").value,
            gpEmp: $('#gpEmp').val(),
        };
        console.log(requestData);

        // Faz a requisição POST para a API
        const response = await fetch(apiUrl, {
            method: "POST", // Método HTTP
            headers: {
                "Content-Type": "application/json", // Define o tipo do conteúdo como JSON
            },
            body: JSON.stringify(requestData), // Converte os dados para JSON
        });

        // Verifica se a requisição foi bem-sucedida
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erro ao salvar a contagem");
        }

        // Lê a resposta JSON retornada pela API
        const responseData = await response.json();

        console.log("Pedido salvo com sucesso:", responseData);
        return responseData; // Retorna o ID gerado ou outra informação
    } catch (error) {
        console.error("Erro ao salvar contagem:", error.message);
        throw error; // Repassa o erro para quem chamou a função
    }
}

async function carregarPedidos() {

    try {
        // URL da API
        const apiUrl = `${apiBase}/consultarPedidos`; // Substitua pelo endpoint correto

        // Faz a requisição para obter os pedidos
        const response = await fetch(apiUrl);

        // Verifica se a resposta foi bem-sucedida
        if (!response.ok) {
            throw new Error("Erro ao carregar pedidos");
        }

        // Converte a resposta em JSON
        const pedidosCompras = await response.json();
        console.log(pedidosCompras);


        // Seleciona o corpo da tabela

        const tabelaBody = document.querySelector("table tbody");


        // Limpa a tabela antes de preenchê-la
        tabelaBody.innerHTML = "";

        // Itera sobre as pendências e adiciona as linhas na tabela
        pedidosCompras.forEach((pedido) => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${pedido.NUMERO_PEDIDO}</td>
                <td>${pedido.MARCA}</td>
                <td>${new Date(pedido.DATA_PEDIDO).toLocaleDateString()}</td>
                <td>${new Date(pedido.DATA_INICIAL).toLocaleDateString()} - ${new Date(pedido.DATA_FINAL).toLocaleDateString()}</td>
                <td>${pedido.GRUPO}</td>
                <td>${pedido.ANDAMENTO}</td>
                <td>
                    <button type="button" class="btn btn-success" onClick="carregarDadosPedido(${pedido.NUMERO_PEDIDO})">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right-square-fill" viewBox="0 0 16 16">
                        <path d="M0 14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2zm4.5-6.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5a.5.5 0 0 1 0-1"></path>
                        </svg>
                    </button>
                    <button type="button" class="btn btn-danger" onClick="apagarPedido(${pedido.NUMERO_PEDIDO})">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash-fill" viewBox="0 0 16 16">
                        <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0"/>
                    </svg>
                    </button>
                </td>
                `;
            tabelaBody.appendChild(row);
        });

        // Adiciona eventos para os botões "Finalizar"
    } catch (error) {
        console.error("Erro ao carregar Pedidos:", error.message);
    }
}

// Removed duplicate carregarPedidos() call - already called in initializePage()

function carregarDadosPedido(id) {
    window.location.href = `/fazerPedidos?id_pedido=${id}`;
}


async function apagarPedido(id_pedido) {
    if (!id_pedido) return;

    const result = await Swal.fire({
        title: 'Tem certeza?',
        text: "Deseja realmente apagar este pedido? Esta ação não pode ser desfeita!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, apagar!',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            // Show loading state
            Swal.fire({
                title: 'Apagando...',
                text: 'Por favor, aguarde.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Faz a requisição para excluir o pedido
            const response = await fetch(`${apiBase}/fecharPedido?id_pedido=${id_pedido}`, {
                method: "DELETE",
            });

            // Verifica se a requisição foi bem-sucedida
            if (!response.ok) {
                throw new Error("Erro ao excluir o pedido");
            }

            // Exibe mensagem de sucesso
            await Swal.fire({
                icon: 'success',
                title: 'Apagado!',
                text: 'Pedido apagado com sucesso.',
                timer: 2000,
                showConfirmButton: false
            });

            // Recarrega a lista de pedidos após a exclusão
            if (typeof carregarPedidos === 'function') {
                await carregarPedidos();
            } else if (typeof carregaPedidosFeitos === 'function') {
                await carregaPedidosFeitos();
            } else {
                window.location.reload();
            }

        } catch (error) {
            console.error("Erro ao apagar o pedido:", error.message);
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Erro ao apagar o pedido. Tente novamente.'
            });
        }
    }
}

// Function to save/finalize a pedido with supplier and payment method
async function salvarPedidoSystem(fornecedorId, formaPagId, numeroPedido) {
    console.log('Dados recebidos:', { formaPagId, fornecedorId, numeroPedido });

    const formaPagElement = document.getElementById(formaPagId);
    const fornecedorElement = document.getElementById(fornecedorId);

    if (!formaPagElement || !fornecedorElement) {
        const errorMsg = 'Elementos não encontrados no DOM';
        console.error(errorMsg, formaPagId, fornecedorId);
        Swal.fire({
            title: 'Erro!',
            text: errorMsg,
            icon: 'error',
            confirmButtonText: 'OK'
        });
        return;
    }

    const idPagamento = formaPagElement.value;
    const idFornecedor = fornecedorElement.value;
    const cod_pagamento = formaPagElement.dataset.codtipvenda;
    const cod_fornecedor = fornecedorElement.dataset.codparc;

    // Validação dos campos obrigatórios
    if (!idPagamento || !idFornecedor || !cod_pagamento || !cod_fornecedor) {
        const errorMsg = 'Todos os campos são obrigatórios';
        console.error(errorMsg);
        Swal.fire({
            title: 'Atenção!',
            text: 'Por favor, preencha o fornecedor e a forma de pagamento antes de finalizar.',
            icon: 'warning',
            confirmButtonText: 'OK'
        });
        return;
    }

    const data = {
        idPagamento: idPagamento,
        idFornecedor: idFornecedor,
        cod_pagamento: cod_pagamento,
        cod_fornecedor: cod_fornecedor,
        numero_pedido: numeroPedido
    };

    console.log('Dados enviados:', data);

    try {
        // Mostrar loader
        Swal.fire({
            title: 'Finalizando Pedido...',
            text: 'Por favor, aguarde',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch('/finalizarPedidoFinal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erro ao finalizar pedido');
        }

        console.log('Resposta do servidor:', result);

        // Montar mensagem completa com resposta da procedure
        let mensagemSucesso = '✅ Pedido finalizado com sucesso!';
        if (result.mensagemProcedure) {
            mensagemSucesso += `\n\nStatus da geração: ${result.mensagemProcedure}`;
        }

        Swal.fire({
            title: 'Sucesso!',
            html: mensagemSucesso.replace(/\n/g, '<br>'),
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#28a745'
        });

        // Recarregar a lista de pedidos após 2 segundos
        setTimeout(() => {
            carregaPedidosFeitos();
        }, 2000);

    } catch (error) {
        console.error('Erro ao finalizar pedido:', error);

        let errorMessage = '❌ Erro ao finalizar pedido';
        if (error.message.includes('ORA-') || error.message.includes('Oracle')) {
            errorMessage += '\nErro no banco de dados: ' + error.message;
        } else {
            errorMessage += ': ' + error.message;
        }

        Swal.fire({
            title: 'Erro!',
            html: errorMessage.replace(/\n/g, '<br>'),
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#dc3545'
        });
    }
}

//PedidosFeitos function to add event listeners for payment methods
async function carregaPedidosFeitos() {
    // Check if we're on the finalizarPedidos page
    if (window.location.pathname === "/finalizarPedidos") {
        console.log("Carregando pedidos feitos");
        try {
            const response = await fetch(`${apiBase}/consultarPedidosFeitos`, {
                method: "GET"
            });

            if (!response.ok) {
                throw new Error("Erro ao carregar pedidos");
            }

            const dadosPedidos = await response.json();
            console.log("Pedidos carregados:", dadosPedidos);

            const pedidosContainer = document.getElementById("pedidosContainer");
            const tabelaBody = document.querySelector("table tbody");
            const emptyState = document.getElementById("emptyState");

            if (pedidosContainer) {
                // Renderização em Cards (Novo Layout)
                pedidosContainer.innerHTML = "";

                if (dadosPedidos.length === 0) {
                    if (emptyState) emptyState.style.display = "block";
                    return;
                }

                if (emptyState) emptyState.style.display = "none";

                dadosPedidos.forEach((pedido, index) => {
                    const fornecedorId = `fornecedor_${pedido.NUMERO_PEDIDO}_${index}`;
                    const fornecedorListaId = `fornecedorLista_${pedido.NUMERO_PEDIDO}_${index}`;
                    const formaPagId = `formaPag_${pedido.NUMERO_PEDIDO}_${index}`;
                    const pagListaId = `pagLista_${pedido.NUMERO_PEDIDO}_${index}`;

                    const card = document.createElement("div");
                    card.className = "pedido-card";
                    card.innerHTML = `
                        <div class="card-header-custom">
                            <span class="pedido-numero">Pedido #${pedido.NUMERO_PEDIDO}</span>
                            <span class="pedido-loja">${pedido.GRUPO}</span>
                            <span class="badge-feito">${pedido.ANDAMENTO}</span>
                        </div>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Marca</span>
                                <span class="info-value">${pedido.MARCA}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Data Pedido</span>
                                <span class="info-value">${new Date(pedido.DATA_PEDIDO).toLocaleDateString()}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Faturamento</span>
                                <span class="info-value">${new Date(pedido.DATAFATURAMENTO).toLocaleDateString()}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Entrega</span>
                                <span class="info-value">${new Date(pedido.DATAENTREGA).toLocaleDateString()}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Valor Total</span>
                                <span class="info-value">R$ ${(pedido.VLRTOTAL || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        <div class="form-section">
                            <div class="form-section-title">Finalização</div>
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <div class="input-group-custom">
                                        <input type="text" class="input-custom" id="${fornecedorId}" placeholder="Buscar Fornecedor..." autocomplete="off">
                                        <div id="${fornecedorListaId}" class="dropdown-menu-custom" style="display: none;"></div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="input-group-custom">
                                        <input type="text" class="input-custom" id="${formaPagId}" placeholder="Forma de Pagamento..." autocomplete="off">
                                        <div id="${pagListaId}" class="dropdown-menu-custom" style="display: none;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="actions-section">
                            <button type="button" class="btn-action btn-success-custom" onClick="salvarPedidoSystem('${fornecedorId}', '${formaPagId}', '${pedido.NUMERO_PEDIDO}')">
                                <i class="bi bi-check-lg"></i> Finalizar
                            </button>
                            <button type="button" class="btn-action btn-primary-custom" onClick="carregarDadosPedido(${pedido.NUMERO_PEDIDO})">
                                <i class="bi bi-pencil"></i> Editar
                            </button>
                            <button type="button" class="btn-action btn-danger-custom" onClick="apagarPedido(${pedido.NUMERO_PEDIDO})">
                                <i class="bi bi-trash"></i> Excluir
                            </button>
                            <button type="button" class="btn-action btn-dark-custom" onClick="exportarPDF(${pedido.NUMERO_PEDIDO})">
                                <i class="bi bi-file-pdf"></i> PDF
                            </button>
                        </div>
                    `;

                    pedidosContainer.appendChild(card);

                    // Add event listeners
                    const inputForn = document.getElementById(fornecedorId);
                    const inputPag = document.getElementById(formaPagId);

                    if (inputForn) {
                        inputForn.addEventListener("input", function () {
                            filtrarFornecedor(fornecedorId, fornecedorListaId);
                        });
                        // Mostrar dropdown ao focar, mesmo vazio
                        inputForn.addEventListener("focus", function () {
                            filtrarFornecedor(fornecedorId, fornecedorListaId);
                        });
                        // Mostrar dropdown ao clicar
                        inputForn.addEventListener("click", function () {
                            filtrarFornecedor(fornecedorId, fornecedorListaId);
                        });
                    }

                    if (inputPag) {
                        inputPag.addEventListener("input", function () {
                            filtrarFormaPagamento(formaPagId, pagListaId);
                        });
                        // Mostrar dropdown ao focar, mesmo vazio
                        inputPag.addEventListener("focus", function () {
                            filtrarFormaPagamento(formaPagId, pagListaId);
                        });
                        // Mostrar dropdown ao clicar
                        inputPag.addEventListener("click", function () {
                            filtrarFormaPagamento(formaPagId, pagListaId);
                        });
                    }
                });

            } else if (tabelaBody) {
                // Renderização em Tabela (Legado/Outras páginas)
                tabelaBody.innerHTML = "";

                dadosPedidos.forEach((pedido, index) => {
                    const row = document.createElement("tr");

                    const fornecedorId = `fornecedor_${pedido.NUMERO_PEDIDO}_${index}`;
                    const fornecedorListaId = `fornecedorLista_${pedido.NUMERO_PEDIDO}_${index}`;
                    const formaPagId = `formaPag_${pedido.NUMERO_PEDIDO}_${index}`;
                    const pagListaId = `pagLista_${pedido.NUMERO_PEDIDO}_${index}`;

                    row.innerHTML = `
                        <td>${pedido.NUMERO_PEDIDO}</td>
                        <td>
                            <input type="text" class="f_size input-pequeno" id="${fornecedorId}">
                            <div id="${fornecedorListaId}" class="dropdown-menu w-100" style="max-height: 200px; overflow-y: auto;"></div>
                        </td>
                        <td>${pedido.MARCA}</td>
                        <td>${new Date(pedido.DATA_PEDIDO).toLocaleDateString()}</td>
                        <td>${new Date(pedido.DATAFATURAMENTO).toLocaleDateString()}</td>
                        <td>${new Date(pedido.DATAENTREGA).toLocaleDateString()}</td>
                        <td>${pedido.GRUPO}</td>
                        <td>${pedido.ANDAMENTO}</td>
                        <td>
                            <input type="text" class="f_size input-pequeno" id="${formaPagId}">
                            <div id="${pagListaId}" class="dropdown-menu w-100" style="max-height: 200px; overflow-y: auto;"></div>
                        </td>
                        <td>${(pedido.VLRTOTAL || 0).toFixed(2)}</td>
                        <td>
                            <button type="button" class="btn btn-success" onClick="salvarPedidoSystem('${fornecedorId}', '${formaPagId}', '${pedido.NUMERO_PEDIDO}')">    
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right-square-fill" viewBox="0 0 16 16">
                                    <path d="M0 14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2zm4.5-6.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5a.5.5 0 0 1 0-1"></path>
                                </svg>
                            </button>
                            <button type="button" class="btn btn-primary" onClick="carregarDadosPedido(${pedido.NUMERO_PEDIDO})">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                                    <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                                    <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
                                </svg>
                            </button>
                            <button type="button" class="btn btn-danger" onClick="apagarPedido(${pedido.NUMERO_PEDIDO})">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash-fill" viewBox="0 0 16 16">
                                    <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0"/>
                                </svg>
                            </button>
                            <button type="button" class="btn btn-dark" onClick="exportarPDF(${pedido.NUMERO_PEDIDO})">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-filetype-pdf" viewBox="0 0 16 16">
                                    <path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2h-1v-1h1a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5zM1.6 11.85H0v3.999h.791v-1.342h.803q.43 0 .732-.173.305-.175.463-.474a1.4 1.4 0 0 0 .161-.677q0-.375-.158-.677a1.2 1.2 0 0 0-.46-.477q-.3-.18-.732-.179m.545 1.333a.8.8 0 0 1-.085.38.57.57 0 0 1-.238.241.8.8 0 0 1-.375.082H.788V12.48h.66q.327 0 .512.181.185.183.185.522m1.217-1.333v3.999h1.46q.602 0 .998-.237a1.45 1.45 0 0 0 .595-.689q.196-.45.196-1.084 0-.63-.196-1.075a1.43 1.43 0 0 0-.589-.68q-.396-.234-1.005-.234zm.791.645h.563q.371 0 .609.152a.9.9 0 0 1 .354.454q.118.302.118.753a2.3 2.3 0 0 1-.068.592 1.1 1.1 0 0 1-.196.422.8.8 0 0 1-.334.252 1.3 1.3 0 0 1-.483.082h-.563zm3.743 1.763v1.591h-.79V11.85h2.548v.653H7.896v1.117h1.606v.638z"/>
                                </svg>
                            </button>
                        </td>
                    `;
                    tabelaBody.appendChild(row);

                    // Add event listeners after the elements are added to the DOM
                    document.getElementById(fornecedorId).addEventListener("input", function () {
                        filtrarFornecedor(fornecedorId, fornecedorListaId);
                    });

                    document.getElementById(formaPagId).addEventListener("input", function () {
                        filtrarFormaPagamento(formaPagId, pagListaId);
                    });
                });

                // Initialize dropdowns if data is already loaded
                if (fornecedoresCarregados) {
                    initializeFornecedorDropdowns();
                }

                if (pagamentosCarregados) {
                    initializeFormaPagDropdowns();
                }

                // Initialize search and filter listeners
                initializeEventListeners();
            } else {
                console.error("Nenhum container (tabela ou cards) encontrado para renderizar os pedidos.");
            }

        } catch (error) {
            console.error("Erro ao consultar Pedidos Prontos:", error.message);
            alert("Erro ao consultar Pedidos Prontos. Tente Novamente");
        }
    }
}

// Function to filter orders by supplier name, brand, and store
function filtrarPedidosPorFornecedor() {
    const searchInput = document.getElementById('searchSupplier');
    const storeFilter = document.getElementById('storeFilter');

    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedStore = storeFilter ? storeFilter.value.toUpperCase() : '';
    const pedidosCards = document.querySelectorAll('.pedido-card');
    let visibleCount = 0;

    pedidosCards.forEach(card => {
        // Find the supplier input field within this card
        const fornecedorInput = card.querySelector('[id^="fornecedor_"]');

        // Find the store/group label within this card
        const lojaElement = card.querySelector('.pedido-loja');

        // Find the brand (marca) within this card
        const infoItems = card.querySelectorAll('.info-item');
        let marcaValue = '';
        infoItems.forEach(item => {
            const label = item.querySelector('.info-label');
            if (label && label.textContent.trim().toLowerCase() === 'marca') {
                const value = item.querySelector('.info-value');
                if (value) marcaValue = value.textContent.toLowerCase();
            }
        });

        if (!fornecedorInput) {
            card.style.display = 'none';
            return;
        }

        const fornecedorValue = fornecedorInput.value.toLowerCase();
        const lojaValue = lojaElement ? lojaElement.textContent.toUpperCase() : '';

        // Check supplier match OR brand match
        const supplierMatch = searchTerm === '' ||
            fornecedorValue.includes(searchTerm) ||
            marcaValue.includes(searchTerm);

        // Check store match
        const storeMatch = selectedStore === '' || lojaValue.includes(selectedStore);

        console.log(`Checking card ${index}: Group="${lojaValue}", Filter="${selectedStore}" => Match=${storeMatch}`);

        // Show card if both filters match
        if (supplierMatch && storeMatch) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    console.log(`Filter complete. Visible: ${visibleCount}/${pedidosCards.length}`);

    // Show/hide empty state
    const emptyState = document.getElementById('emptyState');
    const pedidosContainer = document.getElementById('pedidosContainer');

    if (visibleCount === 0 && pedidosCards.length > 0) {
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.querySelector('h3').textContent = 'Nenhum pedido encontrado';

            let filterMsg = 'Nenhum pedido corresponde aos filtros aplicados';
            if (searchTerm && selectedStore) {
                filterMsg = `Nenhum pedido encontrado para "${searchInput.value}" na loja ${selectedStore}`;
            } else if (searchTerm) {
                filterMsg = `Nenhum pedido corresponde à busca "${searchInput.value}"`;
            } else if (selectedStore) {
                filterMsg = `Nenhum pedido encontrado para a loja ${selectedStore}`;
            }

            emptyState.querySelector('p').textContent = filterMsg;
        }
        if (pedidosContainer) pedidosContainer.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        if (pedidosContainer) pedidosContainer.style.display = 'block';
    }
}

// Initialize event listeners for search and filters
function initializeEventListeners() {
    const searchInput = document.getElementById('searchSupplier');
    const clearButton = document.getElementById('clearSearch');
    const storeFilter = document.getElementById('storeFilter');
    const reportButton = document.getElementById('btnGenerateReport');

    console.log("Initializing event listeners...");

    if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        const activeSearchInput = document.getElementById('searchSupplier');

        activeSearchInput.addEventListener('input', () => {
            console.log("Search input changed");
            filtrarPedidosPorFornecedor();
        });
        activeSearchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                filtrarPedidosPorFornecedor();
            }
        });
    }

    if (clearButton) {
        const newClearButton = clearButton.cloneNode(true);
        clearButton.parentNode.replaceChild(newClearButton, clearButton);

        document.getElementById('clearSearch').addEventListener('click', function () {
            console.log("Clear button clicked");
            const input = document.getElementById('searchSupplier');
            const store = document.getElementById('storeFilter');
            if (input) {
                input.value = '';
                if (store) store.value = '';
                filtrarPedidosPorFornecedor();
                input.focus();
            }
        });
    }

    if (storeFilter) {
        const newStoreFilter = storeFilter.cloneNode(true);
        storeFilter.parentNode.replaceChild(newStoreFilter, storeFilter);

        const activeStoreFilter = document.getElementById('storeFilter');
        activeStoreFilter.addEventListener('change', () => {
            console.log("Store filter changed to:", activeStoreFilter.value);
            filtrarPedidosPorFornecedor();
        });
    }

    if (reportButton) {
        const newReportButton = reportButton.cloneNode(true);
        reportButton.parentNode.replaceChild(newReportButton, reportButton);

        document.getElementById('btnGenerateReport').addEventListener('click', () => {
            console.log("Generate report clicked");
            gerarRelatorioPedidosAbertos();
        });
    }
}

function gerarRelatorioPedidosAbertos() {
    try {
        // Get all visible pedido cards
        const pedidosCards = Array.from(document.querySelectorAll('.pedido-card')).filter(card => card.style.display !== 'none');

        if (pedidosCards.length === 0) {
            Swal.fire({
                title: 'Nenhum Pedido',
                text: 'Não há pedidos visíveis para gerar o relatório.',
                icon: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }

        // Extract data from cards
        const pedidos = pedidosCards.map(card => {
            const numero = card.querySelector('.pedido-numero').textContent.replace('Pedido #', '').trim();
            const marca = card.querySelector('.info-item:nth-child(1) .info-value').textContent.trim();
            const dataPedido = card.querySelector('.info-item:nth-child(2) .info-value').textContent.trim();
            const faturamento = card.querySelector('.info-item:nth-child(3) .info-value').textContent.trim();
            const status = card.querySelector('.badge-feito').textContent.trim();
            const loja = card.querySelector('.pedido-loja').textContent.trim();

            // Try to get the selected supplier if any
            const fornecedorInput = card.querySelector('input[id^="fornecedor_"]');
            const fornecedor = fornecedorInput ? fornecedorInput.value : '';

            return {
                NUMERO_PEDIDO: numero,
                MARCA: marca,
                GRUPO: loja,
                DATA_PEDIDO: dataPedido,
                DATAFATURAMENTO: faturamento,
                ANDAMENTO: status,
                FORNECEDOR_SELECIONADO: fornecedor
            };
        });

        // Get filter description for report header
        const searchInput = document.getElementById('searchSupplier');
        const storeFilter = document.getElementById('storeFilter');
        let filterDescription = '';

        if (searchInput && searchInput.value) {
            filterDescription += `Busca: "${searchInput.value}"`;
        }
        if (storeFilter && storeFilter.value) {
            if (filterDescription) filterDescription += ' | ';
            filterDescription += `Loja: ${storeFilter.value}`;
        }
        if (!filterDescription) {
            filterDescription = 'Todos os pedidos visíveis';
        }

        // Generate report HTML
        let reportHTML = `
            <div style="font-family: 'Inter', sans-serif; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #500001; padding-bottom: 20px;">
                    <h2 style="color: #500001; margin: 0 0 10px 0; font-size: 24px;">
                        📋 Relatório de Pedidos em Aberto
                    </h2>
                    <p style="color: #666; margin: 5px 0; font-size: 14px;">
                        Gerado em: ${new Date().toLocaleString('pt-BR')}
                    </p>
                    <p style="color: #4a5568; margin: 5px 0; font-weight: 600; font-size: 14px;">
                        ${filterDescription}
                    </p>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #500001 0%, #8F1111 100%); color: white;">
                            <th style="padding: 12px; text-align: left; border-radius: 8px 0 0 8px;">Pedido</th>
                            <th style="padding: 12px; text-align: left;">Marca</th>
                            <th style="padding: 12px; text-align: left;">Loja</th>
                            <th style="padding: 12px; text-align: left;">Fornecedor Definido</th>
                            <th style="padding: 12px; text-align: left;">Data Pedido</th>
                            <th style="padding: 12px; text-align: left;">Faturamento</th>
                            <th style="padding: 12px; text-align: center; border-radius: 0 8px 8px 0;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        pedidos.forEach((pedido, index) => {
            const bgColor = index % 2 === 0 ? '#f8fafc' : 'white';
            reportHTML += `
                <tr style="background-color: ${bgColor}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px; font-weight: bold; color: #2d3748;">#${pedido.NUMERO_PEDIDO}</td>
                    <td style="padding: 12px; color: #4a5568;">${pedido.MARCA}</td>
                    <td style="padding: 12px; color: #4a5568;">${pedido.GRUPO}</td>
                    <td style="padding: 12px; color: #4a5568;">${pedido.FORNECEDOR_SELECIONADO || '<span style="color: #cbd5e0;">-</span>'}</td>
                    <td style="padding: 12px; color: #4a5568;">${pedido.DATA_PEDIDO}</td>
                    <td style="padding: 12px; color: #4a5568;">${pedido.DATAFATURAMENTO}</td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="background: #ebf8ff; color: #3182ce; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 11px; text-transform: uppercase;">
                            ${pedido.ANDAMENTO}
                        </span>
                    </td>
                </tr>
            `;
        });

        reportHTML += `
                    </tbody>
                </table>
                <div style="margin-top: 30px; text-align: right; color: #4a5568; font-size: 14px; font-weight: 600;">
                    Total de registros: ${pedidos.length}
                </div>
            </div>
        `;

        // Show report in modal
        Swal.fire({
            title: '',
            html: reportHTML,
            width: '1000px',
            showCancelButton: true,
            confirmButtonText: '<i class="fa fa-print"></i> Imprimir',
            cancelButtonText: 'Fechar',
            confirmButtonColor: '#500001',
            cancelButtonColor: '#718096',
            customClass: {
                popup: 'swal-wide'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // Print the report
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Relatório de Pedidos</title>
                        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                        <style>
                            body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; }
                            @media print {
                                button { display: none; }
                                body { padding: 0; margin: 0; }
                            }
                        </style>
                    </head>
                    <body>
                        ${reportHTML}
                        <div style="text-align: center; margin-top: 20px;">
                            <button onclick="window.print()" style="padding: 12px 24px; background: #500001; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 16px;">
                                Imprimir Agora
                            </button>
                        </div>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            }
        });

    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        Swal.fire({
            title: 'Erro!',
            text: 'Erro ao gerar relatório: ' + error.message,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}


async function carregaPedidosFeitosFinalizados() {
    try {
        // URL da API
        const apiUrl = `${apiBase}/consultarPedidosCompleto`; // Substitua pelo endpoint correto

        // Faz a requisição para obter os pedidos
        const response = await fetch(apiUrl);

        // Verifica se a resposta foi bem-sucedida
        if (!response.ok) {
            throw new Error("Erro ao carregar pedidos");
        }

        // Converte a resposta em JSON
        const pedidosCompras = await response.json();
        console.log("📦 Pedidos Finalizados Carregados:", pedidosCompras);
        if (pedidosCompras.length > 0) {
            console.log("🔍 Exemplo do primeiro pedido:", pedidosCompras[0]);
        } else {
            console.warn("⚠️ Nenhum pedido finalizado encontrado.");
        }


        // Seleciona o corpo da tabela

        const tabelaBody = document.querySelector("table tbody");


        // Limpa a tabela antes de preenchê-la
        tabelaBody.innerHTML = "";

        // Itera sobre as pendências e adiciona as linhas na tabela
        pedidosCompras.forEach((pedido) => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${pedido.NUMERO_PEDIDO}</td>
                <td>${pedido.NUNOTA || 0}</td>
                <td>${pedido.PARCEIRO}</td>
                <td>${pedido.MARCA}</td>
                <td>${pedido.DATA_PEDIDO ? new Date(pedido.DATA_PEDIDO).toLocaleDateString() : ''}</td>
                <td>${pedido.DATAFATURAMENTO ? new Date(pedido.DATAFATURAMENTO).toLocaleDateString() : ''}</td>
                <td>${pedido.DATAENTREGA ? new Date(pedido.DATAENTREGA).toLocaleDateString() : ''}</td>
                <td>${pedido.EMPRESA == '1,3' ? "Exclusiva" : "Prime"}</td>
                <td>${pedido.ANDAMENTO || ''}</td>
                <td>${pedido.FORMA_PAGTO || ''}</td>
                <td>${pedido.VLRTOTAL ? parseFloat(pedido.VLRTOTAL).toFixed(2) : '0.00'}</td>
                <td>
                    <button type="button" class="btn btn-success" onClick="carregarDadosPedido(${pedido.NUMERO_PEDIDO})">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right-square-fill" viewBox="0 0 16 16">
                        <path d="M0 14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2zm4.5-6.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5a.5.5 0 0 1 0-1"></path>
                        </svg>
                    </button>
                    <button type="button" class="btn btn-danger" onClick="apagarPedido(${pedido.NUMERO_PEDIDO})">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash-fill" viewBox="0 0 16 16">
                        <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0"/>
                    </svg>
                    </button>
                </td>
                `;
            tabelaBody.appendChild(row);
        });

        // Adiciona eventos para os botões "Finalizar"
    } catch (error) {
        console.error("Erro ao carregar Pedidos:", error.message);
    }
}

async function exportarPDF(id_pedido) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!id_pedido) throw new Error("ID do pedido não encontrado");

            // Obter dados da API
            const response = await fetch(`${apiBase}/exportarPdf?numero_pedido=${id_pedido}`);
            if (!response.ok) throw new Error("Erro ao buscar dados do pedido");

            const dadosPedido = await response.json();
            if (!dadosPedido || dadosPedido.length === 0) throw new Error("Nenhum item encontrado");

            // Configurar Empresa
            let empresaNome = "Empresa Desconhecida";
            let cnpj = "";
            const codEmpresa = parseInt(dadosPedido[0].CODEMP || 0);

            switch (codEmpresa) {
                case 1: empresaNome = "Exclusiva Utilidades e Embalagens LTDA"; cnpj = "04.023.539/0001-17"; break;
                case 2: empresaNome = "SG Utilidades"; cnpj = "02.444.585/0001-64"; break;
                case 3: empresaNome = "Exclusiva Util Equipamentos LTDA"; cnpj = "09.666.638/0001-30"; break;
                case 4: empresaNome = "Exclusiva Prime 85 LTDA"; cnpj = "21.518.354/0001-00"; break;
                case 5: empresaNome = "Seg Center Comercial LTDA"; cnpj = "24.486.321/0002-97"; break;
                case 6: empresaNome = "Seg Center Comercial LTDA"; cnpj = "24.486.321/0001-06"; break;
                case 7: empresaNome = "Asg Distribuição LTDA"; cnpj = "49.318.824/0001-01"; break;
            }

            if (!window.jspdf) {
                throw new Error("Biblioteca jsPDF não encontrada. Verifique sua conexão com a internet ou instale a biblioteca.");
            }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Adicionar Logo (se existir)
            const img = new Image();
            img.src = "/images/logo.png";

            img.onload = () => {
                doc.addImage(img, "PNG", 14, 10, 60, 15);
                gerarConteudoPDF(doc, empresaNome, cnpj, dadosPedido, id_pedido, resolve);
            };

            img.onerror = () => {
                // Se não carregar logo, gera sem logo
                gerarConteudoPDF(doc, empresaNome, cnpj, dadosPedido, id_pedido, resolve);
            };

        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao gerar PDF',
                text: error.message
            });
            reject(error);
        }
    });
}

function gerarConteudoPDF(doc, empresaNome, cnpj, dadosPedido, id_pedido, resolve) {
    // Cabeçalho
    doc.setFontSize(18);
    doc.setTextColor(80, 0, 1); // Bordô
    doc.text("PEDIDO DE COMPRA", 195, 20, { align: "right" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Nº Pedido: ${id_pedido}`, 195, 28, { align: "right" });
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 195, 33, { align: "right" });

    // Info Empresa
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(empresaNome, 14, 35);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`CNPJ: ${cnpj}`, 14, 40);

    // Tabela
    const colunas = ["REF", "PRODUTO", "QTD"];
    const linhas = dadosPedido
        .filter(item => parseFloat(item.QTD_PEDIR) > 0)
        .map(item => [
            item.REFFORN || item.REFERENCIA,
            item.DESCRPROD,
            item.QTD_PEDIR
        ]);

    doc.autoTable({
        startY: 50,
        head: [colunas],
        body: linhas,
        theme: 'grid',
        headStyles: {
            fillColor: [80, 0, 1], // Bordô
            textColor: 255,
            fontSize: 10,
            fontStyle: 'bold'
        },
        bodyStyles: {
            fontSize: 9,
            textColor: 50
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20, halign: 'center' }
        },
        margin: { top: 50 }
    });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, 195, 290, { align: "right" });
        doc.text(`Gerado em ${new Date().toLocaleString()}`, 14, 290, { align: "left" });
    }

    doc.save(`Pedido_${id_pedido}_${empresaNome.split(' ')[0]}.pdf`);

    // Mostrar mensagem de sucesso
    Swal.fire({
        icon: 'success',
        title: 'PDF Gerado!',
        text: 'O arquivo foi baixado com sucesso.',
        timer: 2000,
        showConfirmButton: false
    });

    if (resolve) resolve();
}
