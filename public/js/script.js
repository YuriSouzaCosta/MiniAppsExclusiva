// public/js/script.js

const apiBase = `${window.location.protocol}//${window.location.hostname}:${window.location.port || 3000}`;

async function buscarProduto() {
  const codigo = document.getElementById("codigo").value.trim();
  if (!codigo) {
    alert("Por favor digite o código de barras");
    return;
  }

  try {
    const response = await fetch(`${apiBase}/produto/${encodeURIComponent(codigo)}`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        alert("Produto não encontrado");
      } else {
        alert("Erro ao buscar produto");
      }
      document.getElementById("nome").textContent = "-";
      document.getElementById("preco").textContent = "-";
      document.getElementById("referencia").textContent = "-";
      return;
    }

    const data = await response.json();
    document.getElementById("nome").textContent = data.NOME || data.nome || "-";
    document.getElementById("preco").textContent = `R$ ${(data.PRECO || data.preco || 0).toFixed(2)}`;
    document.getElementById("referencia").textContent = data.REFERENCIA || data.referencia || "-";

    document.getElementById("quantidade").focus();

  } catch (err) {
    console.error("Erro ao buscar produto:", err);
    alert("Erro de rede ao buscar produto");
  }
}

async function salvarContagem() {
  const usuario = document.getElementById("usuario")?.value?.trim() || "";
  const codigo = document.getElementById("codigo").value.trim();
  const quantidade = document.getElementById("quantidade").value.trim();

  console.log(`Salvar contagem - Usuário: ${usuario}, Código: ${codigo}, Quantidade: ${quantidade}`);

  
  if (!usuario || !codigo || !quantidade) {
    alert("Preencha todos os campos!");
    return;
  }

  try {
    const response = await fetch(`${apiBase}/contagem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        usuario,
        codigo_barra: codigo,
        quantidade: Number(quantidade)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na resposta: ${errorText}`);
    }

    const result = await response.json();
    alert(`Contagem salva com sucesso! ID: ${result.id}`);
    document.getElementById("codigo").value = "";
    document.getElementById("quantidade").value = "";
    document.getElementById("nome").textContent = "-";
    document.getElementById("preco").textContent = "-";
    document.getElementById("referencia").textContent = "-";
    carregarContagens(usuario);

  } catch (err) {
    console.error("Erro ao salvar contagem:", err);
    alert(`Erro: ${err.message}`);
  }
}

async function carregarContagens(usuarioParam) {
	const usuario = (usuarioParam || document.getElementById("usuario")?.value?.trim()).toLowerCase();
	if (!usuario) {
	  console.warn("carregarContagens: usuário não especificado");
	  return;
	}
  
	console.log("carregarContagens para usuário:", usuario);
  
	try {
	  const response = await fetch(`${apiBase}/contagem`, {
		method: "GET",
		headers: {
		  "Accept": "application/json",
		  "Authorization": usuario // 👈 aqui está a mudança
		}
	  });
  
	  console.log("Resposta contagem status:", response.status);
  
	  const tbody = document.querySelector("#tabela-contagens tbody");
	  if (!response.ok) {
		tbody.innerHTML = `<tr><td colspan="3">Nenhuma contagem encontrada para o usuário '${usuario}'.</td></tr>`;
		return;
	  }
  
	  const produtos = await response.json();
	  console.log("Produtos retornados:", produtos);
  
	  tbody.innerHTML = "";
  
	  produtos.forEach((produto) => {
		const codigo = produto.CODIGO_BARRA || produto.codigo_barra;
		const nome = produto.NOME || produto.nome;
		const quantidade = produto.QUANTIDADE || produto.quantidade;
		const id = produto.ID || produto.id;
  
		const tr = document.createElement("tr");
		tr.innerHTML = `
		  <td>${codigo}</td>
		  <td>${nome}</td>
		  <td>
			<input type="number" class="form-control form-control-sm" value="${quantidade}"
				   onchange="atualizarQuantidade(${id}, this.value)" />
		  </td>
		`;
		tbody.appendChild(tr);
	  });
  
	} catch (err) {
	  console.error("Erro ao carregar contagens:", err);
	}
  }
  

async function atualizarQuantidade(id, quantidade) {
  if (!id || quantidade === "") {
    alert("ID ou quantidade inválidos.");
    return;
  }

  try {
    const url = `${apiBase}/contagem/${id}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantidade: Number(quantidade) })
    });
    if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);
    const data = await response.json();
    console.log("Resposta da API:", data);
  } catch (err) {
    console.error("Erro ao atualizar a contagem:", err);
    alert("Erro ao atualizar a contagem.");
  }
}

async function exportarContagens() {
  const usuario = document.getElementById("usuario")?.value?.trim();
  if (!usuario) {
    alert("Usuário não especificado.");
    return;
  }

  const nomeArquivoPrompt = prompt("Digite o nome do arquivo (sem extensão):") || "contagens";
  const nomeArquivo = nomeArquivoPrompt.replace(/[<>:"/\\|?*]/g, "");

  try {
    const response = await fetch(`${apiBase}/exportacao/exportar/${encodeURIComponent(usuario.toLowerCase())}?nomeArquivo=${encodeURIComponent(nomeArquivo)}`, {
      method: "GET"
    });
    if (!response.ok) throw new Error("Erro ao exportar os dados.");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${nomeArquivo}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`Exportação concluída. Usuário: ${usuario}`);
    carregarContagens(usuario);

  } catch (err) {
    console.error(err);
    alert("Erro durante exportação.");
  }
}

async function zerarContagens() {
  const usuario = document.getElementById("usuario")?.value?.trim().toLowerCase();
  if (!usuario) {
    alert("Usuário não especificado.");
    return;
  }
  if (confirm(`Deseja realmente zerar as contagens de ${usuario}?`)) {
    try {
      const response = await fetch(`${apiBase}/contagem/${encodeURIComponent(usuario)}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Erro ao zerar contagens.");
      alert("Contagens zeradas!");
      carregarContagens(usuario);
    } catch (err) {
      console.error(err);
      alert("Erro ao zerar contagens.");
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
	const usuario = document.getElementById("usuario")?.value?.trim();
	console.log("Usuário carregado no DOMContentLoaded:", usuario);
	if (usuario) {
	  carregarContagens(usuario);
	}
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
