const apiBase = `${window.location.protocol}//${window.location.hostname}:3000`;

async function carregarPendencias() {
	try {
		// URL da API
		const apiUrl = `${apiBase}/consultarPendencias`; // Substitua pelo endpoint correto

		// Faz a requisição para obter as pendências
		const response = await fetch(apiUrl);

		// Verifica se a resposta foi bem-sucedida
		if (!response.ok) {
			throw new Error("Erro ao carregar pendências");
		}

		// Converte a resposta em JSON
		const pendencias = await response.json();

		// Seleciona o corpo da tabela
		const tabelaBody = document.querySelector("table tbody");

		// Limpa a tabela antes de preenchê-la
		tabelaBody.innerHTML = "";

		// Itera sobre as pendências e adiciona as linhas na tabela
		pendencias.forEach((pendencia) => {
			const row = document.createElement("tr");

			row.innerHTML = `
        <td>${pendencia.ID_CODE}</td>
        <td>${new Date(pendencia.DATA_INICIO).toLocaleDateString()}</td>
        <td>${pendencia.FORNECEDOR}</td>
        <td>${pendencia.AVARIA}</td>
        <td>${pendencia.DESCRICAO}</td>
        <td>
          <textarea class="form-control solucao-textarea" data-id="${
					pendencia.ID_CODE
				}" placeholder="Descreva como resolver"></textarea>
        </td>
        <td>
          <button class="btn btn-success finalizar-btn" data-id="${
					pendencia.ID_CODE
				}">
            Finalizar
          </button>
        </td>
      `;

			tabelaBody.appendChild(row);
		});

		// Adiciona eventos para os botões "Finalizar"
		document.querySelectorAll(".finalizar-btn").forEach((button) => {
			button.addEventListener("click", async function () {
				const id = this.getAttribute("data-id");

				// Obtém o valor da solução do textarea correspondente
				const textarea = document.querySelector(
					`.solucao-textarea[data-id="${id}"]`
				);
				const solucao = textarea.value.trim();

				// Verifica se o campo solução foi preenchido
				if (!solucao) {
					alert("Por favor, preencha a solução antes de finalizar.");
					return;
				}

				await finalizarPendencia(id, solucao); // Passa a solução para a função
			});
		});
	} catch (error) {
		console.error("Erro ao carregar pendências:", error.message);
	}
}

// Função para finalizar uma pendência com solução
async function finalizarPendencia(id, solucao) {
	try {
		// Define a URL da API para finalizar a pendência
		const apiUrl = `${apiBase}/finalizarPendencia/${id}`; // Substitua pelo endpoint correto

		// Faz a requisição para finalizar a pendência, enviando a solução
		const response = await fetch(apiUrl, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ solucao }), // Envia a solução
		});

		// Verifica se a requisição foi bem-sucedida
		if (!response.ok) {
			throw new Error("Erro ao finalizar a pendência");
		}

		alert("Pendência finalizada com sucesso!");
		// Recarrega a tabela após finalizar
		await carregarPendencias();
	} catch (error) {
		console.error("Erro ao finalizar pendência:", error.message);
		alert("Erro ao finalizar pendência.");
	}
}

// Chama a função para carregar as pendências ao abrir a página
carregarPendencias();
