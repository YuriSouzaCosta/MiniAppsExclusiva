//const apiBase = "http://exclusiva.intranet:3000";
//const apiBase = "http://10.1.20.88:3000";
const apiBase = `${window.location.protocol}//${window.location.hostname}:3000`;

const codigoBarraInput = document.getElementById("codigo");
async function carregarContagens() {
	const usuario = document.getElementById("usuario").value;
	console.log(usuario.toLowerCase());

	const response = await fetch(`${apiBase}/contagens`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			authorization: usuario.toLowerCase(),
		},
	});
	const produtos = await response.json();
	console.log(produtos);

	if (produtos.length === 0) {
		// Exibe uma mensagem caso não haja produtos
		const tabelaBody = document.querySelector("#tabela-contagens tbody");
		tabelaBody.innerHTML =
			"<tr><td colspan='4'>Nenhuma contagem encontrada para este usuário.</td></tr>";
		return; // Finaliza a execução se não houver produtos
	}

	// Função para carregar as contagens na tabela
	const tabelaBody = document.querySelector("#tabela-contagens tbody");
	tabelaBody.innerHTML = ""; // Limpar a tabela antes de adicionar os dados

	// Preencher a tabela com os dados dos produtos
	if (produtos.length >= 1) {
		produtos.forEach((produto) => {
			const row = document.createElement("tr");

			row.innerHTML = `
				<td>${produto.CODIGO_BARRA}</td>
				<td>${produto.NOME}</td>
				<td class="tb-edit">
					<input type="number" value="${produto.QUANTIDADE}" onchange="atualizarQuantidade(${produto.ID}, this.value)">
				</td>
			`;

			tabelaBody.appendChild(row);
		});
	}

	// Foco no campo de código de barra (se necessário)
	codigoBarraInput.focus();
}
document.addEventListener("DOMContentLoaded", () => {
	if (document.getElementById("tabela-contagens")) {
		carregarContagens();
	}
});

async function salvarContagem() {
	const usuario = document.getElementById("usuario").value;
	const codigo = document.getElementById("codigo").value;
	const quantidade = document.getElementById("quantidade").value;

	// Verificar se os campos estão preenchidos
	if (!usuario || !codigo || !quantidade) {
		alert("Preencha todos os campos!");
		return;
	}

	try {
		// Envia a requisição POST para salvar a contagem
		const response = await fetch(`${apiBase}/contagem`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				usuario,
				codigo_barra: codigo,
				quantidade,
			}),
		});

		// Verifica se a resposta foi bem-sucedida
		if (response.ok) {
			const result = await response.json();
			// Limpa os campos após salvar
			document.getElementById("codigo").value = "";
			document.getElementById("quantidade").value = "";

			// Atualiza a tabela de contagens
			carregarContagens();
		} else {
			// Se a resposta não for OK, tenta ler a resposta como texto
			const errorText = await response.text();
			throw new Error(`Erro na resposta: ${errorText}`);
		}
	} catch (err) {
		// Exibe a mensagem de erro
		alert(`Erro: ${err.message}`);
	}
}

async function exportarContagens() {
	const usuario = prompt("Usuário para exportar as contagens:");
	if (!usuario) {
		alert("Usuário não especificado.");
		return;
	}

	let nomeArquivo =
		prompt("Digite o nome do arquivo (sem extensão):") || "contagens";
	nomeArquivo = nomeArquivo.replace(/[<>:"/\\|?*]/g, ""); // Remove caracteres inválidos para nomes de arquivo

	try {
		// Exportar contagens
		const response = await fetch(
			`${apiBase}/exportar/${usuario}?nomeArquivo=${nomeArquivo}`
		);
		if (!response.ok) throw new Error("Erro ao exportar os dados.");

		const blob = await response.blob();
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `${nomeArquivo}.xlsx`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		alert(
			`Exportação concluída e contagens de '${usuario}' marcadas como exportadas.`
		);
	} catch (err) {
		console.error(err);
		alert("Erro durante exportação.");
	}
	carregarContagens();
}

// Função para apagar as contagens
async function ApagarProdutos() {
	var usuario = prompt("Usuario a apagar Produtos : ");
	if (confirm("Deseja realmente apagar os Produtos?")) {
		console.log(usuario);

		await fetch(`${apiBase}/resetar-produtos`, {
			method: "DELETE",
		});
		alert("Produtos zeradas!");
	}
}

// Função para zerar as contagens
async function zerarContagens() {
	if (usuario && confirm("Deseja realmente zerar as contagens?")) {
		console.log(usuario);
		usuario = usuario.toLocaleLowerCase(); // Convertendo para letras minúsculas
		await fetch(`${apiBase}/contagens/${usuario}`, {
			method: "DELETE",
		});
		alert("Contagens zeradas!");
		carregarContagens();
	}
}

// Função para atualizar a quantidade de um produto
async function atualizarQuantidade(id, quantidade) {
	if (!id || !quantidade) {
		alert("ID ou quantidade não fornecidos.");
		return;
	}

	try {
		// Verifique a URL gerada
		const url = `${apiBase}/contagens/${id}`;
		console.log("URL para fetch:", url);

		// Chamada para atualizar a contagem
		const response = await fetch(url, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ quantidade }),
		});

		if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);

		const data = await response.json();
		console.log("Resposta da API:", data);
	} catch (err) {
		console.error("Erro ao atualizar a contagem:", err);
		alert("Erro ao atualizar a contagem.");
	}
}

// Função para excluir uma contagem específica (se necessário)

async function buscarProduto() {
	const codigo = document.getElementById("codigo").value;
	const resultadoDiv = document.getElementById("resultado");
	try {
		const response = await fetch(`${apiBase}/produto/${codigo}`);
		if (!response.ok) throw new Error("Produto não encontrado");
		const produto = await response.json();
		console.log(produto);

		document.getElementById("nome").innerText = produto.NOME;
		document.getElementById("preco").innerText = `R$ ${produto.PRECO}`;
		document.getElementById("referencia").innerText = produto.REFERENCIA;
	} catch (err) {
		resultadoDiv.innerHTML = `<p style="color: red;">${err.message}</p>`;
	}
}

document.addEventListener("DOMContentLoaded", () => {
	const codigoBarraInput = document.getElementById("codigo");

	const quantidadeInput = document.getElementById("quantidade");

	codigoBarraInput.addEventListener("keydown", async (event) => {
		if (event.key === "Enter") {
			event.preventDefault(); // Evita o envio do formulário

			const codigoBarra = codigoBarraInput.value;
			if (!codigoBarra) {
				alert("Digite um código de barras");
				return;
			}

			const produto = await buscarProduto();
			quantidadeInput.focus(); // Move o foco para o campo de quantidade
		}
	});
});

const dropdownItems = document.querySelectorAll(".dropdown-item");
const dropdownToggle = document.getElementById("dropdownMenuLink");
let selectedValue = "";
// Adiciona um evento de clique a cada item
dropdownItems.forEach((item) => {
	item.addEventListener("click", function (event) {
		event.preventDefault(); // Evita comportamento padrão do link
		selectedValue = this.getAttribute("data-value"); // Obtém o valor do atributo data-value
		dropdownToggle.textContent = selectedValue; // Atualiza o texto do botão
	});
});
async function salvarPendencia() {
	try {
		// Define a URL da API
		const apiUrl = `${apiBase}/salvarAvaria`; // Altere para o endpoint correto

		// Configura os dados que serão enviados para a API
		const requestData = {
			avaria: selectedValue,
			fornecedor: document.getElementById("fornecedor").value,
			descricao: document.getElementById("descricao").value,
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

		console.log("Contagem salva com sucesso:", responseData);
		return responseData; // Retorna o ID gerado ou outra informação
	} catch (error) {
		console.error("Erro ao salvar contagem:", error.message);
		throw error; // Repassa o erro para quem chamou a função
	}
}
