const apiBase = `${window.location.protocol}//${window.location.hostname}:3000`;
async function carregarHistoricoPendencias() {
	try {
		// URL da API
		const apiUrl = `${apiBase}/historicoPendencias`;

		// Faz a requisição para obter o histórico
		const response = await fetch(apiUrl);

		// Verifica se a resposta foi bem-sucedida
		if (!response.ok) {
			throw new Error("Erro ao carregar histórico de pendências");
		}

		// Converte a resposta em JSON
		const pendencias = await response.json();

		// Seleciona o corpo da tabela
		const tabelaBody = document.querySelector("table tbody");

		// Limpa a tabela antes de preenchê-la
		tabelaBody.innerHTML = "";

		// Adiciona o histórico de pendências à tabela
		pendencias.forEach((pendencia) => {
			const row = document.createElement("tr");

			row.innerHTML = `
        <td>${pendencia.ID_CODE}</td>
        <td>${new Date(pendencia.DATA_INICIO).toLocaleDateString()}</td>
        <td>${pendencia.FORNECEDOR}</td>
        <td>${pendencia.AVARIA}</td>
        <td>${pendencia.DESCRICAO}</td>
        <td>${pendencia.SOLUCAO}</td>
        <td>${new Date(pendencia.DATA_FIM).toLocaleDateString()}</td>
      `;

			tabelaBody.appendChild(row);
		});
	} catch (error) {
		console.error("Erro ao carregar histórico de pendências:", error.message);
	}
}

// Chama a função para carregar o histórico ao carregar a página
carregarHistoricoPendencias();
