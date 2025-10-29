const apiBase = `${window.location.protocol}//${window.location.hostname}:3000`;


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
    if (window.location.pathname === "/listaPedidos") {
        // Add event listeners for input fields that exist on the current page
        const marcaInput = document.getElementById("marca");
        if (marcaInput) {
            marcaInput.addEventListener("input", filtrarMarcas);
        }
        carregarPedidos();
    } else if (window.location.pathname === "/finalizarPedidos") {
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
        
        fornDisponiveis = data.map(({CODPARC, CGC_CPF, RAZAOSOCIAL, NOMEPARC}) => 
            ({"CODPARC": CODPARC, "CNPJ": CGC_CPF, "NOME": RAZAOSOCIAL, "PARCEIRO": NOMEPARC})
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
        
        pagDisponiveis = data.map(({CODTIPVENDA, DESCRTIPVENDA}) => 
            ({"CODTIPVENDA": CODTIPVENDA, "DESCRTIPVENDA": DESCRTIPVENDA})
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
    
    
    if (valorDigitado.length === 0) {
        dropdown.classList.remove("show");
        return;
    }
    
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
        return;
    }
    
    // Filtra localmente a lista de FORNECEDORES
    let filtradasForne = fornDisponiveis.filter(dado => 
        (dado.NOME && dado.NOME.toLowerCase().includes(valorDigitado)) || 
        (dado.PARCEIRO && dado.PARCEIRO.toLowerCase().includes(valorDigitado)) || 
        (dado.CNPJ && dado.CNPJ.toLowerCase().includes(valorDigitado))
    );

    if (filtradasForne.length === 0) {
        dropdown.classList.remove("show");
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
        };
        dropdown.appendChild(item);
    });

    dropdown.classList.add("show");
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

    if (valorDigitado.length === 0) {
        dropdown.classList.remove("show");
        return;
    }
    
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
        return;
    }
    
    // Filtra localmente a lista de formas de pagamento
    let filtradasPag = pagDisponiveis.filter(dado => 
        dado.DESCRTIPVENDA && dado.DESCRTIPVENDA.toLowerCase().includes(valorDigitado)
    );

    if (filtradasPag.length === 0) {
        dropdown.classList.remove("show");
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
        };
        dropdown.appendChild(item);
    });

    dropdown.classList.add("show");
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

if (window.location.pathname == '/listaPedidos') {
    
    carregarPedidos();
    console.log('entrou');
    
}

function carregarDadosPedido(id) {
    window.location.href = `/fazerPedidos?id_pedido=${id}`;
}


async function apagarPedido(id_pedido) {
    if (id_pedido && confirm("Deseja realmente apagar o pedido?")) {
        try {
            console.log(id_pedido);

            // Faz a requisição para excluir o pedido
            const response = await fetch(`${apiBase}/fecharPedido?id_pedido=${id_pedido}`, {
                method: "DELETE",
            });

            // Verifica se a requisição foi bem-sucedida
            if (!response.ok) {
                throw new Error("Erro ao excluir o pedido");
            }

            // Exibe mensagem de sucesso
            alert("Pedido apagado com sucesso!");

            // Recarrega a lista de pedidos após a exclusão
            await carregarPedidos(); // Aguarda a conclusão de carregarPedidos
        } catch (error) {
            console.error("Erro ao apagar o pedido:", error.message);
            alert("Erro ao apagar o pedido. Tente novamente.");
        }
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
            console.log(dadosPedidos);

            const tabelaBody = document.querySelector("table tbody");
            
            if (!tabelaBody) {
                console.error("Tabela não encontrada na página");
                return;
            }

            // Limpa a tabela antes de preenchê-la
            tabelaBody.innerHTML = "";

            dadosPedidos.forEach((pedido, index) => {
                const row = document.createElement("tr");
                
                // Criando IDENTIFICADOR PARA CADA ELEMENTO DA LINHA
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
                document.getElementById(fornecedorId).addEventListener("input", function() {
                    filtrarFornecedor(fornecedorId, fornecedorListaId);
                });
                
                document.getElementById(formaPagId).addEventListener("input", function() {
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
            
        } catch (error) {
            console.error("Erro ao consultar Pedidos Prontos:", error.message);
            alert("Erro ao consultar Pedidos Prontos. Tente Novamente");
        }        
    }
}



// Function to initialize payment method dropdowns

function initializeFormaPagDropdowns() {
    // Find all payment method input fields
    const formaPagInputs = document.querySelectorAll("[id^='formaPag_']");
    
    formaPagInputs.forEach(input => {
        input.addEventListener("input", function() {
            const dropdownId = input.id.replace('formaPag_', 'pagLista_');
            filtrarFormaPagamento(input.id, dropdownId);
        });
    });

}
// Function to initialize supplier dropdowns after loading data
function initializeFornecedorDropdowns() {
    // Find all supplier input fields
    const fornecedorInputs = document.querySelectorAll("[id^='fornecedor_']");
    
    fornecedorInputs.forEach(input => {
        input.addEventListener("input", function() {
            const dropdownId = input.id.replace('fornecedor_', 'fornecedorLista_');
            filtrarFornecedor(input.id, dropdownId);
        });
    });
}


async function salvarPedidoSystem(fornecedorId, formaPagId, numeroPedido) {
    console.log('Dados recebidos:', {formaPagId, fornecedorId, numeroPedido});

    const formaPagElement = document.getElementById(formaPagId);
    const fornecedorElement = document.getElementById(fornecedorId);

    if (!formaPagElement || !fornecedorElement) {
        const errorMsg = 'Elementos não encontrados no DOM';
        console.error(errorMsg, formaPagId, fornecedorId);
        exibirModal(errorMsg, 'error');
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
        exibirModal(errorMsg, 'error');
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
        // Mostrar loader enquanto processa
        showLoader(true);
        
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

        exibirModal(mensagemSucesso, 'success');
        
        // Recarregar a lista de pedidos após 3 segundos
        setTimeout(() => {
            carregaPedidosFeitos();
        }, 3000);

    } catch (error) {
        console.error('Erro ao finalizar pedido:', error);
        
        let errorMessage = '❌ Erro ao finalizar pedido';
        if (error.message.includes('ORA-') || error.message.includes('Oracle')) {
            errorMessage += '\nErro no banco de dados: ' + error.message;
        } else {
            errorMessage += ': ' + error.message;
        }
        
        exibirModal(errorMessage, 'error');
    } finally {
        // Esconder loader
        showLoader(false);
    }
}

// Função para exibir/ocultar loader
function showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

// Função para exibir o modal com a mensagem (atualizada)
function exibirModal(mensagem, tipo) {
    const modal = new bootstrap.Modal(document.getElementById('mensagemModal'));
    const modalBody = document.getElementById('mensagemModalBody');
    const modalTitle = document.getElementById('mensagemModalLabel');
    const modalIcon = document.getElementById('mensagemModalIcon');
    
    // Configurar ícone e cores conforme o tipo
    if (tipo === 'success') {
        modalTitle.style.color = '#28a745';
        modalIcon.className = 'bi bi-check-circle-fill text-success me-2';
        modalIcon.style.fontSize = '1.5rem';
    } else {
        modalTitle.style.color = '#dc3545';
        modalIcon.className = 'bi bi-exclamation-circle-fill text-danger me-2';
        modalIcon.style.fontSize = '1.5rem';
    }
    
    // Permitir quebras de linha na mensagem
    modalBody.innerHTML = mensagem.replace(/\n/g, '<br>');
    
    modal.show();
}

    

carregaPedidosFeitos()

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
                <td>${pedido.NUNOTA || 0}</td>
                <td>${pedido.PARCEIRO}</td>
                <td>${pedido.MARCA}</td>
                <td>${new Date(pedido.DATA_PEDIDO).toLocaleDateString()}</td>
                <td>${new Date(pedido.DATA_FATURAMENTO).toLocaleDateString()}</td>
                <td>${new Date(pedido.DATA_ENTREGA).toLocaleDateString()}</td>
                <td>${pedido.EMPRESA == '1,3' ? "Exclusiva" : "Prime"}</td>
                <td>${pedido.STATUS}</td>
                <td>${pedido.FORMA_PAGAMENTO}</td>
                <td>${pedido.VALOR_TOTAL}</td>
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
    try {
        console.log("Iniciando geração do PDF...");


        
        if (!id_pedido) {
            throw new Error("ID do pedido não encontrado na URL");
        }

        // 1. Buscar os dados do pedido na API
        const response = await fetch(`${apiBase}/exportarPdf?numero_pedido=${id_pedido}`);
        if (!response.ok) {
            throw new Error(`Erro ao buscar dados do pedido: ${response.status}`);
        }
        
        const dadosPedido = await response.json();
        console.log("Dados recebidos da API:", dadosPedido);

        if (!dadosPedido || dadosPedido.length === 0) {
            throw new Error("Nenhum item encontrado para este pedido");
        }

        // 2. Determinar empresa e CNPJ com base no primeiro item (todos devem ter o mesmo CODEMP)
        const codemp = dadosPedido[0].CODEMP;
        let empresa = "";
        let cnpj = "";

        switch (Number(codemp)) {
            case 1:
                empresa = "Exclusiva Utilidades e Embalagens LTDA";
                cnpj = "04.023.539/0001-17";
                break;
            case 2:
                empresa = "SG Utilidades";
                cnpj = "02.444.585/0001-64";
                break;
            case 3:
                empresa = "Exclusiva Util Equipamentos LTDA";
                cnpj = "09.666.638/0001-30";
                break;
            case 4:
                empresa = "Exclusiva Prime 85 LTDA";
                cnpj = "21.518.354/0001-00";
                break;
            case 5:
                empresa = "Seg Center Comercial LTDA";
                cnpj = "24.486.321/0002-97";
                break;
            case 6:
                empresa = "Seg Center Comercial LTDA";
                cnpj = "24.486.321/0001-06";
                break;
            case 7:
                empresa = "Asg Distribuição LTDA";
                cnpj = "49.318.824/0001-01";
                break;
            default:
                empresa = "Empresa não identificada";
                cnpj = "CNPJ não disponível";
        }

        console.log(`Empresa: ${empresa} - CNPJ: ${cnpj}`);

        // 3. Criar o PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Adicionar logo (se disponível)
        const img = new Image();
        img.src = "/images/logo.png";

        // Função para adicionar conteúdo após o carregamento da imagem
        const addContentToPDF = () => {
            // Cabeçalho do PDF
            doc.setFontSize(20, 'bold');
            doc.text("Pedido de Compra", 14, 20);
            
            doc.setFontSize(12);
            doc.text(`Número do Pedido: ${id_pedido}`, 14, 30);
            doc.text(`Razão Social: ${empresa}`, 14, 36);
            doc.text(`CNPJ: ${cnpj}`, 14, 42);
            doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 48);

            // Adicionar imagem (se carregada)
            try {
                doc.addImage(img, "PNG", 120, 10, 70, 20);
            } catch (e) {
                console.warn("Não foi possível adicionar a logo:", e.message);
            }

            // Preparar dados para a tabela
            const dadosTabela = dadosPedido.map(item => [
                item.REFFORN || "",
                item.DESCRPROD || "",
                item.QTD_PEDIR || "0"
            ]);

            // Calcular total de itens
            

            // Adicionar tabela ao PDF
            doc.autoTable({
                startY: 55,
                head: [["REFERÊNCIA", "DESCRIÇÃO DO PRODUTO", "QUANTIDADE"]],
                body: dadosTabela,
                styles: { 
                    fontSize: 9,
                    cellPadding: 2,
                    overflow: 'linebreak'
                },
                columnStyles: {
                    0: { cellWidth: 30 },
                    1: { cellWidth: 130 },
                    2: { cellWidth: 30 }
                },
                margin: { left: 10, right: 10 },
                theme: 'grid'
            });

            

            // Salvar o PDF
            doc.save(`Pedido_${id_pedido}.pdf`);
        };

        // Se a imagem carregar, adiciona ao PDF, senão continua sem a logo
        img.onload = addContentToPDF;
        img.onerror = () => {
            console.warn("Erro ao carregar logo, gerando PDF sem imagem...");
            addContentToPDF();
        };

    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        
    }
}
