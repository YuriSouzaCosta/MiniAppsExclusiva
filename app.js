const express = require("express");
const oracledb = require("oracledb");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = 3000;
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + '/public'));

// Configuração do banco de dados SQLite
app.use(express.static("public"));
const dbConfigOracle = {
	user: "JIVA", // Substitua pelo seu nome de usuário
	password: "tecsis", // Substitua pela sua senha
	connectString: "10.100.1.19:1521/orcl", // Substitua com sua string de conexão Oracle
	//connectString: "exclusiva.duckdns.org:18012/orcl",
};
//oracledb.initOracleClient({ libDir: "C:/instantclient_21_12" }); // windows
oracledb.initOracleClient();

async function getOracleConnection() {
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		return connection;
	} catch (err) {
		console.error("Erro ao conectar ao OracleDB: ", err);
		throw err;
	}
}

app.get("/", (req, res) => {
	res.render("login");
});



app.post("/coletor", (req, res) => {
	const nome = req.body.name;
	var varReq = "equal";
	if (
		nome.toLowerCase() == "yuri" ||
		nome.toLowerCase() == "luiz" ||
		nome.toLowerCase() == "lucas" ||
		nome.toLowerCase() == "giliarde"
	) {
		varReq = "entrei";

		res.render("coletorDev", { name: nome, casoUsuario: varReq });
	}
	varReq = "Not entrei";
	res.render("coletor", { name: nome, casoUsuario: varReq });
});

app.get("/importador", (req, res) => {
	res.render("importador");
});

// Middleware
app.use(bodyParser.json());
app.use(cors());
// Rotas
app.get("/produto/:codigo_barra", async (req, res) => {
	const { codigo_barra } = req.params;
	let connection;

	try {
		// Obtendo a conexão com o OracleDB
		connection = await getOracleConnection();

		// Consultando o banco de dados Oracle
		const result = await connection.execute(
			`SELECT nome, preco, referencia 
             FROM VW_PRODUTOS_BLC 
             WHERE codigo_barra = :codigo_barra`,
			[codigo_barra] // Bind variável
		);

		// Verificando se o produto foi encontrado
		if (result.rows && result.rows.length > 0) {
			// Enviando a resposta com os dados do produto
			const row = result.rows[0];
			const mappedResult = {};
			// Iterando sobre os nomes das colunas e criando um objeto com chave-valor
			result.metaData.forEach((column, index) => {
				mappedResult[column.name] = row[index];
			});
			// Enviando a resposta com os dados do produto mapeados
			res.json(mappedResult);
		} else {
			res.status(404).json({ error: "Produto não encontrado" });
		}
	} catch (err) {
		console.error("Erro ao consultar o banco de dados: ", err);
		res.status(500).json({ error: err.message });
	} finally {
		if (connection) {
			try {
				// Fechar a conexão com o banco
				await connection.close();
			} catch (err) {
				console.error("Erro ao fechar a conexão: ", err);
			}
		}
	}
});

app.post("/contagem", async (req, res) => {
	const { codigo_barra, quantidade, usuario } = req.body;

	// Verifica se os campos necessários foram enviados
	if (!codigo_barra || !quantidade || !usuario) {
		return res
			.status(400)
			.json({ error: "Todos os campos são obrigatórios" });
	}

	const insertQuery = `
        INSERT INTO AD_CONTAGENS (codigo_barra, quantidade, usuario)
        VALUES (:codigo_barra, :quantidade, :usuario)
        RETURNING id INTO :id
    `;

	let connection;

	try {
		// Conectar ao banco Oracle
		connection = await oracledb.getConnection(dbConfigOracle);

		// Prepare a variável de saída para o ID gerado
		const result = await connection.execute(
			insertQuery,
			{
				codigo_barra: codigo_barra,
				quantidade: quantidade,
				usuario: usuario,
				id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }, // Prepara para retornar o ID
			},
			{
				autoCommit: true, // Garante que a transação será confirmada automaticamente
			}
		);

		// O ID gerado será armazenado em result.outBinds.id
		const novoId = result.outBinds.id[0];

		// Retorna a resposta com sucesso e o ID gerado
		res.json({
			message: "Contagem salva com sucesso",
			id: novoId,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Erro ao salvar contagem" });
	} finally {
		if (connection) {
			await connection.close();
		}
	}
});

// Inicialização do servidor
app.listen(port, () => {
	console.log(`Servidor rodando em http://localhost:${port}`);
});

const multer = require("multer");
const xlsx = require("xlsx");
const path = require("path");

// Configuração do multer para upload de arquivos
// const upload = multer({
// 	dest: "uploads/", // Pasta temporária para uploads
// });

// Rota para upload de arquivo Excel e importação de dados

// app.post("/importar", upload.single("arquivo"), (req, res) => {
// 	const filePath = req.file.path;

// 	try {
// 		const workbook = xlsx.readFile(filePath);
// 		const sheetName = workbook.SheetNames[0];
// 		const worksheet = workbook.Sheets[sheetName];
// 		const dados = xlsx.utils.sheet_to_json(worksheet, { defval: null });

// 		console.log(`Total de registros no Excel: ${dados.length}`);

// 		// Inicia uma transação para garantir consistência
// 		db.serialize(() => {
// 			// Preparar as declarações
// 			const updateStmt = db.prepare(`
//                 UPDATE produtos
//                 SET nome = ?, preco = ?, referencia = ?, codprod = ?
//                 WHERE codigo_barra = ?
//             `);

// 			const insertStmt = db.prepare(`
//                 INSERT INTO produtos (codigo_barra, nome, preco, referencia, codprod)
//                 VALUES (?, ?, ?, ?, ?)
//             `);

// 			let atualizados = 0;
// 			let inseridos = 0;

// 			// Iniciar transação
// 			db.run("BEGIN TRANSACTION");

// 			// Processar os dados do Excel
// 			dados.forEach((produto, index) => {
// 				const codigoBarra = produto["REFERENCIA"];
// 				const nome = produto["DESCRPROD"];
// 				const preco = parseFloat(produto["PRECO"]);
// 				const referenciaFornecedor = produto["REFFORN"];
// 				const codSankhya = produto["CODPROD"];

// 				console.log(`Processando produto ${index + 1}/${dados.length}`);
// 				console.log(`Dados do produto: ${JSON.stringify(produto)}`);

// 				if (!codigoBarra) {
// 					console.error("Erro: código de barra vazio ou inválido.");
// 					return;
// 				}

// 				db.get(
// 					"SELECT * FROM produtos WHERE codigo_barra = ?",
// 					[codigoBarra],
// 					(err, row) => {
// 						if (err) {
// 							console.error("Erro ao verificar produto:", err);
// 							return;
// 						}

// 						if (row) {
// 							// Atualizar produto existente
// 							updateStmt.run(
// 								[
// 									nome,
// 									preco,
// 									referenciaFornecedor,
// 									codSankhya,
// 									codigoBarra,
// 								],
// 								(err) => {
// 									if (err) {
// 										console.error(
// 											`Erro ao atualizar produto (codigo_barra: ${codigoBarra}):`,
// 											err
// 										);
// 									} else {
// 										atualizados++;
// 									}
// 								}
// 							);
// 						} else {
// 							// Inserir novo produto
// 							insertStmt.run(
// 								[
// 									codigoBarra,
// 									nome,
// 									preco,
// 									referenciaFornecedor,
// 									codSankhya,
// 								],
// 								(err) => {
// 									if (err) {
// 										console.error(
// 											`Erro ao inserir produto (codigo_barra: ${codigoBarra}):`,
// 											err
// 										);
// 									} else {
// 										inseridos++;
// 									}
// 								}
// 							);
// 						}
// 					}
// 				);
// 			});

// 			// Finaliza a transação
// 			db.run("COMMIT", (err) => {
// 				if (err) {
// 					console.error("Erro ao finalizar transação:", err);
// 					return res
// 						.status(500)
// 						.json({ error: "Erro ao processar arquivo" });
// 				}

// 				// Finalizar as declarações
// 				updateStmt.finalize();
// 				insertStmt.finalize();

// 				console.log(
// 					`Produtos atualizados: ${atualizados}, inseridos: ${inseridos}`
// 				);

// 				// Resposta de sucesso
// 				res.json({
// 					message: "Importação concluída com sucesso.",
// 					atualizados,
// 					inseridos,
// 				});
// 			});
// 		});
// 	} catch (error) {
// 		console.error("Erro ao processar arquivo:", error);
// 		res.status(500).json({ error: "Erro ao processar arquivo" });
// 	} finally {
// 		// Remover o arquivo temporário
// 		fs.unlinkSync(filePath);
// 	}
// });
const fs = require("fs");
const { log } = require("console");
// Função para simular/gerar contagens no banco
function gerarContagens() {
	const stmt = db.prepare(
		"INSERT INTO AD_CONTAGENS (usuario, codigo_barra, quantidade) VALUES (?, ?, ?)"
	);

	contagensFicticias.forEach((contagem) => {
		stmt.run(
			[contagem.usuario, contagem.codigo_barra, contagem.quantidade],
			(err) => {
				if (err) {
					console.error("Erro ao gerar contagem:", err.message);
				}
			}
		);
	});

	stmt.finalize((err) => {
		if (err) return reject(err);
		resolve();
	});
}
// Rota para exportar contagens
app.get("/exportar/:usuario", async (req, res) => {
	const { usuario } = req.params;
	const { nomeArquivo } = req.query; // Captura o nome do arquivo dos parâmetros da query string

	console.log(`Usuário recebido: ${usuario}`);
	console.log(`Nome do arquivo recebido: ${nomeArquivo}`);

	// Nome do arquivo, padrão será "contagens.xlsx" caso o usuário não informe
	const fileName = nomeArquivo ? `${nomeArquivo}.xlsx` : "contagens.xlsx";

	// Conexão com o banco de dados Oracle
	let connection;

	try {
		connection = await oracledb.getConnection(dbConfigOracle);

		// Query para obter os dados da tabela de contagens
		const query = `
            SELECT c.id, p.codprod, c.codigo_barra, c.quantidade, p.nome, p.preco
            FROM AD_CONTAGENS c
            JOIN VW_PRODUTOS_BLC p ON c.codigo_barra = p.codigo_barra
            WHERE LOWER(c.usuario) = :usuario
			and C.SITUACAO is null `;

		const result = await connection.execute(query, [usuario.toLowerCase()]);

		if (result.rows.length === 0) {
			return res.status(404).json({
				error: "Nenhuma contagem encontrada para o usuário especificado",
			});
		}

		// Transformar os dados em um formato adequado para o Excel
		const dados = result.rows.map((row) => ({
			ID: row[0],
			CODPROD: row[1],
			"Código de Barra": row[2],
			Produto: row[4],
			Preço: row[5].toFixed(2),
			Quantidade: row[3],
		}));

		// Criação de um novo workbook
		const workbook = xlsx.utils.book_new();
		const worksheet = xlsx.utils.json_to_sheet(dados);

		// Adicionar a worksheet ao workbook
		xlsx.utils.book_append_sheet(workbook, worksheet, "Contagens");

		// Gerar o arquivo Excel na memória
		const filePath = `./${fileName}`;
		xlsx.writeFile(workbook, filePath);

		// Atualizar os registros de contagem para "E" na coluna SITUACAO
		const updateQuery = `
            UPDATE AD_CONTAGENS
            SET situacao = 'E'
            WHERE LOWER(usuario) = :usuario
			AND situacao is null
        `;

		await connection.execute(updateQuery, [usuario.toLowerCase()]);
		await connection.commit(); // Confirma as alterações no banco

		// Enviar o arquivo para o cliente
		res.download(filePath, fileName, (err) => {
			if (err) {
				console.error("Erro ao enviar o arquivo:", err);
				return res.status(500).send("Erro ao enviar o arquivo");
			}

			// Remover o arquivo após o download
			fs.unlink(filePath, (unlinkErr) => {
				if (unlinkErr) {
					console.error(
						"Erro ao remover o arquivo temporário:",
						unlinkErr
					);
				}
			});
		});
	} catch (err) {
		console.error("Erro na execução:", err);
		return res.status(500).json({ error: "Erro ao processar a exportação" });
	} finally {
		if (connection) {
			try {
				await connection.close();
			} catch (err) {
				console.error("Erro ao fechar a conexão:", err);
			}
		}
	}
});

app.delete("/contagens/:usuario", (req, res) => {
	const { usuario } = req.params; // Obtém o usuário dos parâmetros da URL

	if (!usuario) {
		return res
			.status(400)
			.json({ error: "Usuário não especificado nos parâmetros da URL" });
	}

	db.run(
		"DELETE FROM AD_CONTAGENS WHERE LOWER(usuario) = ?",
		[usuario],
		(err) => {
			if (err) {
				return res
					.status(500)
					.json({ error: "Erro ao zerar as contagens" });
			}
			res.json({ message: "Todas as contagens foram zeradas com sucesso." });
		}
	);
});

// Função para consultar as contagens
app.get("/contagens", async (req, res) => {
	const usuario = req.headers["authorization"]; // Obtém o usuário do cabeçalho

	if (!usuario) {
		return res
			.status(400)
			.json({ error: "Usuário não especificado no cabeçalho" });
	}

	const query = `
        SELECT c.id, c.codigo_barra, p.nome, p.preco, c.quantidade, c.usuario
        FROM AD_CONTAGENS c
        JOIN VW_PRODUTOS_BLC p ON c.codigo_barra = p.codigo_barra
        WHERE LOWER(c.usuario) = LOWER(:usuario)
		AND c.situacao is null
		ORDER BY C.ID DESC
    `;

	let connection;

	try {
		// Conecta ao banco Oracle
		connection = await oracledb.getConnection(dbConfigOracle);

		// Executa a consulta
		const result = await connection.execute(query, [usuario], {
			outFormat: oracledb.OUT_FORMAT_OBJECT,
		});

		// Verifique se há resultados
		if (result.rows.length === 0) {
			return res
				.status(404)
				.json({ error: "Nenhuma contagem encontrada para este usuário" });
		}

		// Retorna os resultados
		res.json(result.rows); // Envia as linhas de resultado como resposta
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Erro ao buscar contagens" });
	} finally {
		// Fecha a conexão com o banco de dados
		if (connection) {
			await connection.close();
		}
	}
});

app.put("/contagens/:id", async (req, res) => {
	const { id } = req.params;
	const { quantidade } = req.body;

	if (!quantidade) {
		return res.status(400).json({ error: "Quantidade é obrigatória" });
	}

	let connection;

	try {
		// Estabelecendo a conexão com o banco de dados
		connection = await oracledb.getConnection(dbConfigOracle);

		// Atualizando a contagem no banco de dados
		const result = await connection.execute(
			`
            UPDATE AD_CONTAGENS 
            SET quantidade = :quantidade 
            WHERE id = :id
            `,
			{ quantidade, id }, // Parâmetros de bind para evitar SQL Injection
			{ autoCommit: true } // Realiza o commit automaticamente
		);

		// Verifica se a atualização foi realizada
		if (result.rowsAffected === 0) {
			return res.status(404).json({ error: "Contagem não encontrada" });
		}

		res.json({ message: "Contagem atualizada com sucesso." });
	} catch (err) {
		console.error("Erro ao atualizar a contagem:", err);
		res.status(500).json({ error: "Erro ao atualizar a contagem" });
	} finally {
		if (connection) {
			try {
				await connection.close();
			} catch (err) {
				console.error("Erro ao fechar a conexão:", err);
			}
		}
	}
});

app.delete("/resetar-produtos", (req, res) => {
	db.serialize(() => {
		// Inicia a transação
		db.run("BEGIN TRANSACTION", (err) => {
			if (err) {
				console.error("Erro ao iniciar transação:", err);
				return res.status(500).json({ error: "Erro ao iniciar transação" });
			}
		});

		// Apaga todos os produtos
		db.run("DELETE FROM produtos", (err) => {
			if (err) {
				console.error("Erro ao apagar produtos:", err);
				db.run("ROLLBACK"); // Reverte em caso de erro
				return res.status(500).json({ error: "Erro ao apagar produtos" });
			}
		});

		// Reinicia o contador de IDs
		db.run("DELETE FROM sqlite_sequence WHERE name='produtos'", (err) => {
			if (err) {
				console.error("Erro ao reiniciar sequência de IDs:", err);
				db.run("ROLLBACK"); // Reverte em caso de erro
				return res.status(500).json({
					error: "Erro ao reiniciar sequência de IDs",
				});
			}
		});

		// Finaliza a transação
		db.run("COMMIT", (err) => {
			if (err) {
				console.error("Erro ao finalizar transação:", err);
				return res
					.status(500)
					.json({ error: "Erro ao finalizar transação" });
			}

			console.log("Produtos apagados e IDs reiniciados com sucesso.");
			res.json({
				message: "Produtos apagados e IDs reiniciados com sucesso.",
			});
		});
	});
});
/*-----------------------------PRODUTOS AVARIADOS--------------------------------*/
app.get("/pendenciaFornecedor", (req, res) => {
	res.render("pendenciaFornecedores");
});
app.get("/consultaPendenciaFornecedor", (req, res) => {
	res.render("consultaPendenciaFornecedor");
});
app.get("/historicoPendenciaFornecedor", (req, res) => {
	res.render("historicoPendenciaFornecedor");
});
app.post("/salvarAvaria", async (req, res) => {
	const { avaria, fornecedor, descricao } = req.body;

	// Verifica se os campos necessários foram enviados
	if (!avaria || !fornecedor || !descricao) {
		return res
			.status(400)
			.json({ error: "Todos os campos são obrigatórios" });
	}

	const insertQuery = `
	INSERT INTO AD_PROD_QUEBRADO (AVARIA, FORNECEDOR, DESCRICAO, DATA_INICIO, SITUACAO)
	VALUES (:AVARIA, :FORNECEDOR, :DESCRICAO, SYSDATE, 'ABERTO')
	RETURNING ID_CODE INTO :id
`;

	let connection;

	try {
		// Conectar ao banco Oracle
		connection = await oracledb.getConnection(dbConfigOracle);

		// Prepare a variável de saída para o ID gerado
		const result = await connection.execute(
			insertQuery,
			{
				AVARIA: avaria,
				fornecedor: fornecedor,
				descricao: descricao,
				id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }, // Prepara para retornar o ID
			},
			{
				autoCommit: true, // Garante que a transação será confirmada automaticamente
			}
		);

		// O ID gerado será armazenado em result.outBinds.id
		const novoId = result.outBinds.id[0];

		// Retorna a resposta com sucesso e o ID gerado
		res.json({
			message: "Contagem salva com sucesso",
			id: novoId,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Erro ao salvar contagem" });
	} finally {
		if (connection) {
			await connection.close();
		}
	}
});
app.get("/consultarPendencias", async (req, res) => {
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `SELECT ID_CODE, DATA_INICIO, FORNECEDOR, AVARIA, DESCRICAO, SITUACAO FROM AD_PROD_QUEBRADO WHERE SITUACAO <> 'Finalizada'`;

		const result = await connection.execute(query, [], {
			outFormat: oracledb.OUT_FORMAT_OBJECT,
		});

		res.json(result.rows);
	} catch (err) {
		console.error("Erro ao consultar pendências:", err.message);
		res.status(500).json({ error: "Erro ao consultar pendências" });
	}
});
app.put("/finalizarPendencia/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const { solucao } = req.body; // Solução enviada no body

		if (!solucao) {
			return res.status(400).json({ error: "A solução é obrigatória" });
		}

		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `
      UPDATE AD_PROD_QUEBRADO 
      SET SITUACAO = 'Finalizada', 
          DATA_FIM = SYSDATE, 
          SOLUCAO = :solucao 
      WHERE ID_CODE = :id
    `;

		await connection.execute(query, [solucao, id], { autoCommit: true });
	} catch (err) {
		console.error("Erro ao finalizar pendência:", err.message);
		res.status(500).json({ error: "Erro ao finalizar pendência" });
	}
});
app.get("/historicoPendencias", async (req, res) => {
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `
      SELECT ID_CODE, DATA_INICIO, DATA_FIM, FORNECEDOR, AVARIA, DESCRICAO, SOLUCAO
      FROM AD_PROD_QUEBRADO
      WHERE SITUACAO = 'Finalizada'
      ORDER BY DATA_FIM DESC
    `;

		const result = await connection.execute(query, [], {
			outFormat: oracledb.OBJECT,
		});

		res.json(result.rows);
	} catch (err) {
		console.error("Erro ao consultar histórico:", err.message);
		res.status(500).json({ error: "Erro ao consultar histórico" });
	}
});
/*------------------------------------------------------------ PEDIDOS DE COMPRAS ------------------------------------------ */

app.get("/pedidosCompras", (req, res) => {
	res.render("pedidoCompras");
});
app.get("/listaPedidos", (req, res) => {
	res.render("listaPedidos");
});

app.get("/fazerPedidos", (req, res) => {
	
	res.render("fazerPedidos");
});
app.get("/pedidosFinalizados", (req, res) => {
	
	res.render("pedidoFinalizados");
});
app.get("/finalizarPedidos", (req, res) => {
	res.render("finalizarPedidos");
});
app.get("/carregarMarcas", async (req, res) => {
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `select descricao from TGFMAR`;

		const result = await connection.execute(query, [], {
			outFormat: oracledb.OUT_FORMAT_OBJECT,
		});

		res.json(result.rows);
	} catch (err) {
		console.error("Erro ao consultar pendências:", err.message);
		res.status(500).json({ error: "Erro ao consultar pendências" });
	}
});

app.post("/criarPedido", async (req, res) => {
	const { dtInit, dtEnd, marca,gpEmp } = req.body;

	

	// Verifica se os campos necessários foram enviados
	if (!dtInit || !dtEnd || !marca || !gpEmp) {
		return res
			.status(400)
			.json({ error: "Todos os campos são obrigatórios" });
	}
	let gp;
	if(gpEmp == 1 ){
		gp = 'EXCLUSIVA';
		emp = '1,3';
	}if(gpEmp == 2){
		gp = 'PRIME';
		emp = '2,4,7';
	}if(gpEmp == 3){
		gp = 'SITE';
		emp = '5'
	}


	const insertQuery = `
	INSERT INTO CABECALHO_PEDIDO_YSC (MARCA, DATA_INICIAL, DATA_FINAL, GRUPO, ANDAMENTO, DATA_PEDIDO, EMPRESA)
	VALUES (:MARCA, TO_DATE(:DATA_INICIAL, 'YYYY-MM-DD'), TO_DATE(:DATA_FINAL, 'YYYY-MM-DD'), :GP_EMP, 'ABERTO', SYSDATE, :EMPRESA)
	RETURNING NUMERO_PEDIDO INTO :id
	
`;

	let connection;

	try {
		// Conectar ao banco Oracle
		connection = await oracledb.getConnection(dbConfigOracle);

		// Prepare a variável de saída para o ID gerado
		const result = await connection.execute(
			insertQuery,
			{
				MARCA: marca,
				Data_INICIAL: dtInit,
				DATA_FINAL: dtEnd,
				GP_EMP : gp,
				EMPRESA : emp,
				id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }, // Prepara para retornar o ID
			},
			{
				autoCommit: true, // Garante que a transação será confirmada automaticamente
			}
		);

		// O ID gerado será armazenado em result.outBinds.id
		const novoId = result.outBinds.id[0];

		// Retorna a resposta com sucesso e o ID gerado
		res.json({
			message: "Contagem salva com sucesso",
			id: novoId,
		});

		// Retorna a resposta com sucesso e o ID gerado
			} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Erro ao salvar contagem" });
	} finally {
		if (connection) {
			await connection.close();
		}
	}
});

app.get("/consultarPedidos", async (req, res) => {
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `SELECT NUMERO_PEDIDO,MARCA,trunc(DATA_PEDIDO) as DATA_PEDIDO,trunc(DATA_INICIAL) as DATA_INICIAL,trunc(DATA_FINAL) as DATA_FINAL,GRUPO,ANDAMENTO FROM CABECALHO_PEDIDO_YSC WHERE ANDAMENTO = 'ABERTO' ORDER BY NUMERO_PEDIDO`;

		const result = await connection.execute(query, [], {
			outFormat: oracledb.OUT_FORMAT_OBJECT,
		});

		res.json(result.rows);
	} catch (err) {
		console.error("Erro ao consultar pedidos:", err.message);
		res.status(500).json({ error: "Erro ao consultar pedidos" });
	}
});

app.get("/dadosPlanilhas/:id_ped", async (req, res) => {
	const {id_ped} = req.params;
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `SELECT CODEMP,NUMERO_PEDIDO,MARCA,TO_CHAR(trunc(DATA_PEDIDO), 'YYYY-MM-DD') as DATA_PEDIDO, TO_CHAR(trunc(DATAFATURAMENTO), 'YYYY-MM-DD') as DATAFATURAMENTO,GRUPO,ANDAMENTO, TO_CHAR(trunc(DATAENTREGA), 'YYYY-MM-DD') as DATAENTREGA FROM CABECALHO_PEDIDO_YSC WHERE NUMERO_PEDIDO = :id_ped ORDER BY NUMERO_PEDIDO`;

		const result = await connection.execute(query, [id_ped], {
			outFormat: oracledb.OUT_FORMAT_OBJECT,
		});

		res.json(result.rows);
	} catch (err) {
		console.error("Erro ao consultar pedidos:", err.message);
		res.status(500).json({ error: "Erro ao consultar pedidos" });
	}
});

app.post("/loadPedidos", async (req, res) => {
	const { id_pedido } = req.query;
	
	
	if (!id_pedido) {
		return res
			.status(400)
			.json({ error: "Todos os campos são obrigatórios" });
	}
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `select * from PEDIDO_PROCESSADO_YSC where NUMERO_PEDIDO = :ID_PED ORDER BY LINHA,DESCRPROD`;

		const result = await connection.execute(query, {
			ID_PED : id_pedido,
		},
		{
			outFormat: oracledb.OUT_FORMAT_OBJECT,
		});
		
		
		res.json(result.rows);
	} catch (err) {
		console.error("Erro ao consultar pedidos:", err.message);
		res.status(500).json({ error: "Erro ao consultar pedidos" });
	}
});

app.delete("/listaPedidos/:id_pedido", (req, res) => {
	const { id_pedido } = req.params;
	
	
});
app.post('/salvarPedidos', async (req, res) => {
let connection;
try {
	// 1. Validação e normalização dos dados
	const pedidos = Array.isArray(req.body) ? req.body : [req.body];
	
	// 2. Conectar ao banco
	connection = await oracledb.getConnection(dbConfigOracle);

	// 3. Preparar binds com tipos explícitos
	const binds = pedidos.map(pedido => [
		Number(pedido.quantidade),
		Number(pedido.valorTotal),
		Number(pedido.id),
		Number(pedido.codProd)
	]);

	// 4. Executar atualização com executeMany
	const result = await connection.executeMany(
		`UPDATE PEDIDO_PROCESSADO_YSC 
		 SET QTD_PEDIR = :1, VLR_TOTAL = :2 
		 WHERE NUMERO_PEDIDO = :3 AND CODPROD = :4`,
		binds,
		{
			autoCommit: true,
			bindDefs: [
				{ type: oracledb.NUMBER },
				{ type: oracledb.NUMBER },
				{ type: oracledb.NUMBER },
				{ type: oracledb.NUMBER }
			]
		}
	);

	res.json({
		success: true,
		message: `${pedidos.length} pedidos atualizados`,
		rowsAffected: result.rowsAffected
	});

} catch (err) {
	console.error("Erro no servidor:", {
		message: err.message,
		stack: err.stack,
		inputData: req.body
	});

	res.status(500).json({
		success: false,
		error: "Erro ao processar pedidos",
		details: process.env.NODE_ENV === 'development' ? err.message : null
	});
} finally {
	if (connection) {
		try {
			await connection.close();
		} catch (closeErr) {
			console.error("Erro ao fechar conexão:", closeErr);
		}
	}
}
});


// Funções auxiliares para conversão segura
function ensureNumber(value, fieldName) {
    const num = Number(value);
    if (isNaN(num)) {
        throw new Error(`Campo ${fieldName} com valor inválido: ${value}`);
    }
    return num;
}

function ensureString(value, fieldName) {
    if (value === null || value === undefined) {
        throw new Error(`Campo ${fieldName} não pode ser nulo`);
    }
    return String(value);
}

app.post('/fecharPedido', async (req, res) => {
	try {
		const { id , CodEmp, dataFaturamento, dataEntrega, valorTotal } = req.body;
		console.log(typeof(id), typeof(CodEmp));
		
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `
   			UPDATE CABECALHO_PEDIDO_YSC SET ANDAMENTO = 'FEITO', CODEMP = :CodEmp, DATAENTREGA = TO_DATE(:dataEntrega, 'YYYY-MM-DD'), DATAFATURAMENTO = TO_DATE(:dataFaturamento, 'YYYY-MM-DD'), VLRTOTAL = :valorTotal
             WHERE NUMERO_PEDIDO = :id `;

		await connection.execute(query, {CodEmp, dataEntrega, dataFaturamento, valorTotal,id} , { autoCommit: true });
		res.json({result : "Pedido Finalizado com Sucesso"})
		} catch (err) {
		const { id , CodEmp } = req.body;
		console.error("Erro ao finalizar pendência:", err.message);
		res.status(500).json({ error: "Erro ao finalizar pendência",id, CodEmp });
	}
});
app.delete('/fecharPedido', async (req, res) => {
	try {
		const { id_pedido } = req.query;

		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `
   			delete CABECALHO_PEDIDO_YSC
             WHERE NUMERO_PEDIDO = :id `;

		await connection.execute(query, [ id_pedido], { autoCommit: false });
		const query2 = `
   			delete PEDIDO_PROCESSADO_YSC 
             WHERE NUMERO_PEDIDO = :id `;

		await connection.execute(query2, [ id_pedido], { autoCommit: false });
		await connection.commit();
		await connection.close();
		res.json({message : "Apagou o pedido "});
	} catch (err) {
		console.error("Erro ao finalizar pendência:", err.message);
		res.status(500).json({ error: "Erro ao finalizar pendência" });
	}
});

app.get("/consultarPedidosFeitos", async (req, res) => {
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `SELECT * FROM CABECALHO_PEDIDO_YSC WHERE ANDAMENTO <> 'ABERTO' AND ANDAMENTO <> 'FINALIZADO' ORDER BY NUMERO_PEDIDO desc`;

		const result = await connection.execute(query, [], {
			outFormat: oracledb.OUT_FORMAT_OBJECT,
		});

		res.json(result.rows);
	} catch (err) {
		console.error("Erro ao consultar pedidos:", err.message);
		res.status(500).json({ error: "Erro ao consultar pedidos" });
	}
});
//carregaFornecedores
app.get("/carregarFornecedores", async (req, res) => {
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `select * from VW_FORNECEDORES_YSC`;

		const result = await connection.execute(query, [], {
			outFormat: oracledb.OUT_FORMAT_OBJECT,
		});
		
		res.json(result.rows);
	} catch (err) {
		console.error("Erro ao consultar pendências:", err.message);
		res.status(500).json({ error: "Erro ao consultar pendências" });
	}
});

//carregaFormasDePagamento
app.get("/carregarFormaPagamentos", async (req, res) => {
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `select * from VW_FORMA_PAGAMENTO_YSC`;

		const result = await connection.execute(query, [], {
			outFormat: oracledb.OUT_FORMAT_OBJECT,
		});
		
		res.json(result.rows);
	} catch (err) {
		console.error("Erro ao consultar pendências:", err.message);
		res.status(500).json({ error: "Erro ao consultar pe	ndências" });
	}
});
app.post('/finalizarPedidoFinal', async (req, res) => {
    let connection;
    try {
        const { numero_pedido, cod_fornecedor, idFornecedor, idPagamento, cod_pagamento } = req.body;
        
        // 1. Conectar ao banco de dados
        connection = await oracledb.getConnection(dbConfigOracle);
        
        // 2. Atualizar o pedido
        const updateQuery = `
            UPDATE CABECALHO_PEDIDO_YSC 
            SET ANDAMENTO = 'FINALIZADO',
                COD_PARCEIRO = :cod_fornecedor, 
                PARCEIRO = :idFornecedor, 
                COD_FORMA_PAGTO = :cod_pagamento, 
                FORMA_PAGTO = :idPagamento
            WHERE NUMERO_PEDIDO = :numero_pedido`;
        
        await connection.execute(updateQuery, {
            cod_fornecedor, 
            idFornecedor, 
            cod_pagamento, 
            idPagamento,
            numero_pedido
        }, { autoCommit: false }); // Não commitar ainda

        // 3. Chamar a procedure
        const result = await connection.execute(
            `BEGIN
                JIVA.STP_GERARPEDCOMPRA_IMPORT_YSC(
                    :P_NUM_PEDIDO,
                    :P_MENSAGEM
                );
            END;`,
            {
                P_NUM_PEDIDO: numero_pedido,
                P_MENSAGEM: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
            }
        );

        const mensagemProcedure = result.outBinds.P_MENSAGEM;

        // Se chegou até aqui, commit das alterações
        await connection.commit();

        res.json({ 
            success: true,
            result: "Pedido Finalizado com Sucesso",
            mensagemProcedure: mensagemProcedure
        });

    } catch (err) {
        // Rollback em caso de erro
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackErr) {
                console.error("Erro no rollback:", rollbackErr);
            }
        }
        
        console.error("Erro ao finalizar pedido:", err.message);
        res.status(500).json({ 
            success: false,
            error: "Erro ao finalizar pedido",
            details: err.message
        });
    } finally {
        // Liberar a conexão
        if (connection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error("Erro ao fechar conexão:", closeErr);
            }
        }
    }
});

app.get("/consultarPedidosCompleto", async (req, res) => {
	try {
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `SELECT 
    NUMERO_PEDIDO,
    MARCA,
	NUNOTA,
    DATA_PEDIDO AS DATA_PEDIDO,
    NVL(parceiro, 'Não Definido') AS PARCEIRO,
    NVL(forma_pagto, 'Não Definido') AS FORMA_PAGAMENTO,
    NVL(empresa, 'Não Definido') AS EMPRESA,
    NVL(TO_CHAR(vlrtotal, 'FM999G999G990D00'), 'Não Definido') AS VALOR_TOTAL,
    Dataentrega AS DATA_ENTREGA,
    datafaturamento AS DATA_FATURAMENTO,
    ANDAMENTO AS STATUS
FROM 
    CABECALHO_PEDIDO_YSC 
    
ORDER BY  
    NUMERO_PEDIDO DESC` ;

		const result = await connection.execute(query, [], {
			outFormat: oracledb.OUT_FORMAT_OBJECT,
		});

		res.json(result.rows);
	} catch (err) {
		console.error("Erro ao consultar pedidos:", err.message);
		res.status(500).json({ error: "Erro ao consultar pedidos" });
	}
});

app.get("/exportarPdf" ,async (req, res) => {
	try {
		const {numero_pedido} = req.query;
		const connection = await oracledb.getConnection(dbConfigOracle);
		const query = `select DET.DESCRPROD, DET.REFFORN, DET.QTD_PEDIR, CAB.CODEMP, CAB.MARCA from PEDIDO_PROCESSADO_YSC DET
			INNER JOIN CABECALHO_PEDIDO_YSC CAB ON CAB.NUMERO_PEDIDO = DET.NUMERO_PEDIDO WHERE CAB.NUMERO_PEDIDO = :numero_pedido and det.qtd_pedir > 0`
		const result = await connection.execute(query, [numero_pedido], {outFormat: oracledb.OUT_FORMAT_OBJECT});

		res.json(result.rows);	
	} catch (err) {
		console.error("Erro ao consultar pedidos:", err.message);
		res.status(500).json({ error: "Erro ao consultar pedidos" });
	}
});

/*********************************************************------------------------SYSTEM CONTROLE DE COMPRAS-----------------------**********************************************************/


const storage = multer.diskStorage({
	destination: (req, file, cb) => {
	  cb(null, 'uploads/'); // Pasta onde os arquivos serão salvos temporariamente
	},
	filename: (req, file, cb) => {
	  cb(null, Date.now() + path.extname(file.originalname)); // Nome único para o arquivo
	}
  });
  
  const upload = multer({ 
	storage: storage,
	fileFilter: (req, file, cb) => {
	  // Lista de tipos MIME aceitos
	  const allowedMimeTypes = [
		'application/vnd.ms-excel', // .xls
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
		'text/csv',
		'application/csv',
		'text/x-csv',
		'application/octet-stream' // Fallback para alguns CSVs
	  ];
  
	  // Verifica extensões permitidas (case insensitive)
	  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
	  const fileExtension = path.extname(file.originalname).toLowerCase();
  
	  // Verifica tanto o MIME type quanto a extensão
	  if (allowedMimeTypes.includes(file.mimetype) && 
		  allowedExtensions.includes(fileExtension)) {
		return cb(null, true);
	  }
  
	  // Mensagem de erro mais descritiva
	  cb(new Error(`Tipo de arquivo inválido. Apenas os seguintes formatos são aceitos: ${allowedExtensions.join(', ')}`));
	},
	limits: {
	  fileSize: 10 * 1024 * 1024 // 10MB (ajuste conforme necessário)
	}
  });


app.get("/dashboard/Compras", async (req, res) => {
	res.render("ControlCompras/home");
});
app.get("/dashboard/Pedidos", async (req, res) => {
	res.render("ControlCompras/step1_compras");
});
app.get("/dashboard/RelatorioPedidos", async (req, res) => {
	res.render("ControlCompras/step2_compras");
});
app.get("/dashboard/Conferencia", async (req, res) => {
	res.render("ControlCompras/step3_compras");
});
app.get("/dashboard/Lancamento", async (req, res) => {
	res.render("ControlCompras/step4_compras");
});
app.get("/dashboard/Precificado", async (req, res) => {
	res.render("ControlCompras/step5_compras");
});

app.post('/api/importar-nfe', upload.single('planilha'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ 
            error: 'Nenhum arquivo enviado ou tipo de arquivo inválido',
            allowedTypes: ['xlsx', 'xls', 'csv']
        });
    }

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfigOracle);
        const filePath = req.file.path;
        let dados = [];

        // Processar arquivo (mantenha seu código atual de leitura)
        if (filePath.endsWith('.xlsx')) {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            dados = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        } else if (filePath.endsWith('.csv')) {
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => dados.push(row))
                    .on('end', resolve)
                    .on('error', reject);
            });
        }

        let registrosInseridos = 0;
        let registrosDuplicados = 0;
        let registrosComErro = 0;

        for (const row of dados) {
            if (!row.chave_nfe || !row.cnpj_fornecedor || !row.n_nota || !row.valor_nfe || !row.dt_emissao) {
                registrosComErro++;
                continue;
            }

            // Verificar se a chave já existe
            const checkResult = await connection.execute(
                `SELECT COUNT(*) as count FROM ad_control_buy_ysc WHERE CHAVE_NFE = :chave_nfe`,
                { chave_nfe: row.chave_nfe }
            );

            if (checkResult.rows[0][0] > 0) {
                registrosDuplicados++;
                continue;
            }

            // Converter data
            const dtEmissao = parseDate(row.dt_emissao);
            if (!dtEmissao) {
                registrosComErro++;
                continue;
            }

            // Inserir registro
            try {
                const result = await connection.execute(
                    `INSERT INTO ad_control_buy_ysc 
                     (CHAVE_NFE, CNPJ_FORNE, N_NOTA, VALOR_NFE, DT_EMISSIAO, CNPJ_DESTINATARIO) 
                     VALUES (:chave_nfe, :cnpj_fornecedor, :n_nota, :valor_nfe, TO_DATE(:dt_emissao, 'YYYY-MM-DD'), :cnpj_destinatario)`,
                    {
                        chave_nfe: row.chave_nfe,
                        cnpj_fornecedor: row.cnpj_fornecedor,
                        n_nota: row.n_nota,
                        valor_nfe: parseFloat(row.valor_nfe),
                        dt_emissao: dtEmissao,
                        cnpj_destinatario: row.cnpj_destinatario
                    }
                );
                registrosInseridos += result.rowsAffected;
            } catch (insertError) {
                registrosComErro++;
                console.error('Erro ao inserir:', insertError);
            }
        }

        await connection.commit();
        res.json({ 
            success: true,
            message: `Processamento concluído!`,
            stats: {
                total: dados.length,
                inserted: registrosInseridos,
                duplicates: registrosDuplicados,
                errors: registrosComErro
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ 
            error: 'Erro durante a importação',
            details: error.message
        });
    } finally {
        if (connection) await connection.close().catch(console.error);
        if (req.file) fs.unlinkSync(req.file.path);
    }
});

app.get('/api/notas-fiscais', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfigOracle);
        
        const result = await connection.execute(
            `SELECT 
                TO_CHAR(a.DT_EMISSIAO, 'DD/MM/YYYY') AS data_emissao,
                a.FORNECEDOR AS fornecedor,
                a.N_NOTA AS numero_nota,
                A.VALOR_NFE AS valor,
                A.CNPJ_DESTINATARIO AS empresa,
                a.CHAVE_NFE AS chave
             FROM ad_control_buy_ysc a
			 where a.dt_chegada is null	
             ORDER BY a.DT_EMISSIAO asc`
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                data: row[0],
                fornecedor: row[1],
                nota: row[2],
                valor: row[3],
                empresa: row[4],
                chave: row[5]
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar notas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar notas fiscais'
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Erro ao fechar conexão:', err);
            }
        }
    }
});

app.get('/api/notas-fiscais-entregues', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfigOracle);
        
        const result = await connection.execute(
            `SELECT 
                TO_CHAR(a.DT_EMISSIAO, 'DD/MM/YYYY') AS data_emissao,
				TO_CHAR(a.DT_CHEGADA, 'DD/MM/YYYY HH24:MI:SS' ) AS DT_CHEGADA,
                a.FORNECEDOR AS fornecedor,
                a.N_NOTA AS numero_nota,
                A.VALOR_NFE AS valor,
                A.CNPJ_DESTINATARIO AS empresa,
                a.CHAVE_NFE AS chave
             FROM ad_control_buy_ysc a
			 where a.dt_chegada is not null	
			 and a.dt_emiss_rel is null
             ORDER BY a.dt_chegada DESC`
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                data: row[0],
				dt_chegada : row[1],
                fornecedor: row[2],
                nota: row[3],
                valor: row[4],
                empresa: row[5],
                chave: row[6]
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar notas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar notas fiscais'
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Erro ao fechar conexão:', err);
            }
        }
    }
});
app.get('/api/notas-fiscais-aguardando-conf', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfigOracle);
        
        const result = await connection.execute(
            `SELECT 
                
				TO_CHAR(a.dt_emiss_rel, 'DD/MM/YYYY HH24:MI:SS' ) AS DT_EMISSAO,
                a.FORNECEDOR AS fornecedor,
                a.N_NOTA AS numero_nota,
                A.VALOR_NFE AS valor,
                A.CNPJ_DESTINATARIO AS empresa,
                a.CHAVE_NFE AS chave
             FROM ad_control_buy_ysc a
			 where a.dt_chegada is not null	
			 and a.dt_emiss_rel is NOT null
			 and a.dt_conf is null
             ORDER BY a.DT_EMISSIAO DESC`
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                data_emiss: row[0],
                fornecedor: row[1],
                nota: row[2],
                valor: row[3],
                empresa: row[4],
                chave: row[5]
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar notas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar notas fiscais'
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Erro ao fechar conexão:', err);
            }
        }
    }
});

app.get('/api/notas-fiscais-aguardando-lancamento', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfigOracle);
        
        const result = await connection.execute(
            `SELECT 
                a.FORNECEDOR AS fornecedor,
                a.N_NOTA AS numero_nota,
                A.CNPJ_DESTINATARIO AS empresa,
                a.CHAVE_NFE AS chave
             FROM ad_control_buy_ysc a
			 where a.dt_chegada is not null	
			 and a.dt_emiss_rel is NOT null
			 and a.dt_conf is not null
			 and a.DT_ENT_LANC IS NULL
             ORDER BY a.DT_EMISSIAO DESC`
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                fornecedor: row[0],
                nota: row[1],
                empresa: row[2],
                chave: row[3]
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar notas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar notas fiscais'
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Erro ao fechar conexão:', err);
            }
        }
    }
});

app.get('/api/notas-fiscais-precificadas', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfigOracle);
        
        const result = await connection.execute(
            `SELECT 
                TO_CHAR(a.DT_EMISSIAO, 'DD/MM/YYYY') AS data_emissao,
				TO_CHAR(a.DT_CHEGADA, 'DD/MM/YYYY HH24:MI:SS' ) AS DT_CHEGADA,
                a.FORNECEDOR AS fornecedor,
                a.N_NOTA AS numero_nota,
                A.VALOR_NFE AS valor,
                A.CNPJ_DESTINATARIO AS empresa,
                a.CHAVE_NFE AS chave,
				to_char(a.dt_preci, 'DD/MM/YYYY HH24:MI:SS' ) AS DT_PRECI
             FROM ad_control_buy_ysc a
			 where a.dt_chegada is not null	
			 and a.dt_emiss_rel is not null
			 and a.dt_conf is not null
			 and a.dt_preci is not null
			 
             ORDER BY a.dt_chegada DESC`
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                data: row[0],
				dt_chegada : row[1],
                fornecedor: row[2],
                nota: row[3],
                valor: row[4],
                empresa: row[5],
                chave: row[6],
				dt_preci : row[7]
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar notas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar notas fiscais'
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Erro ao fechar conexão:', err);
            }
        }
    }
});

app.get('/api/nota-precificada/:chave', async (req, res) => {
	const { chave } = req.params;
    let connection;
    try {
		const params = { chave };
        connection = await oracledb.getConnection(dbConfigOracle);

	 let query = `select par.razaosocial, ite.nunota , pro.referencia, pro.refforn,pro.descrprod, ite.codprod, ite.qtdneg , snk_preco(0,ite.codprod) as preco, cab.AD_DT_ALT_PREC, loc.DESCRLOCAL  from tgfite ite
				inner  join tgfpro pro on pro.codprod = ite.codprod
				inner join tgfcab cab on cab.nunota = ite.nunota
				inner join tgfpar par on par.codparc = cab.codparc
				inner join tgfloc loc on loc.codlocal = ite.codlocalorig
			where ite.nunota =  (select nunota from ad_control_buy_ysc where chave_nfe = :chave)`
        
        const result = await connection.execute(query, params);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                razaosocial: row[0],
				nunota: row[1],
                cod_barra: row[2],
                referencia: row[3],
                produto: row[4],
                codprod: row[5],
                qtdneg: row[6],
				preco : row[7],
				dt_preci : row[8],
				local : row[9]
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar notas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar notas fiscais'
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Erro ao fechar conexão:', err);
            }
        }
    }
});

app.put('/api/notas-fiscais/:chave', async (req, res) => {
    const { chave } = req.params;
    const { acao } = req.body; // Número de 1 a 6
	console.log(chave, acao);
	
    if (!chave || !acao || acao < 1 || acao > 6) {
        return res.status(400).json({ 
            error: 'Parâmetros inválidos',
            details: 'Chave e ação (1-6) são obrigatórios'
        });
    }

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfigOracle);
        
        let query;
		let query2;
        const params = { chave };
        
        switch(acao) {
            case 1: // Chegada
                query = `UPDATE ad_control_buy_ysc SET DT_CHEGADA = SYSDATE WHERE CHAVE_NFE = :chave`;
                break;
            case 2: // Emissão
                query = `UPDATE ad_control_buy_ysc SET DT_EMISS_REL = SYSDATE WHERE CHAVE_NFE = :chave`;
                break;
            case 3: // Conferencia
                query = `UPDATE ad_control_buy_ysc SET DT_CONF = SYSDATE WHERE CHAVE_NFE = :chave`;
                break;
            case 4: // Lançamento
                query = `UPDATE ad_control_buy_ysc SET DT_ENT_LANC = SYSDATE WHERE CHAVE_NFE = :chave`;
				query2 = `UPDATE ad_control_buy_ysc SET NUNOTA = (SELECT NUNOTA FROM TGFCAB WHERE CHAVENFE = :chave)  WHERE CHAVE_NFE = :chave`;
                break;
            case 5: // Precificação
                query = `UPDATE ad_control_buy_ysc SET DT_PAGAMENTO = SYSDATE WHERE CHAVE_NFE = :chave`;
                break;
            case 6: // Divergente
                query = `UPDATE ad_control_buy_ysc SET FL_DIVERGENTE = 1 WHERE CHAVE_NFE = :chave`;
                break;
        }

        const result = await connection.execute(query, params);

		let result2;
		if (acao === 4 && query2) {
			result2 = await connection.execute(query2, params);
		}
				

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Nota fiscal não encontrada' });
        }

        await connection.commit();
        res.json({ 
            success: true,
            message: `Nota fiscal atualizada (Ação ${acao})`
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Erro ao atualizar nota:', error);
        res.status(500).json({ 
            error: 'Erro ao atualizar nota fiscal',
            details: error.message
        });
    } finally {
        if (connection) await connection.close().catch(console.error);
    }
});

/**------------------------------FECHAMNETO BLING------------------------------------------**/

app.get("/produtos_full/:codigo_barra", async (req, res) => {
	const { codigo_barra } = req.params;
	let connection;

	try {
		// Obtendo a conexão com o OracleDB
		connection = await getOracleConnection();

		// Consultando o banco de dados Oracle
		const result = await connection.execute(
			`SELECT CODPROD, CODIGO_BARRA, nome, preco, CUSTO, MARCA, CUSTO_S_IPI
             FROM VW_PRODUTOS_BLC 
             WHERE codigo_barra = :codigo_barra`,
			[codigo_barra] // Bind variável
		);

		// Verificando se o produto foi encontrado
		if (result.rows && result.rows.length > 0) {
			// Enviando a resposta com os dados do produto
			const row = result.rows[0];
			const mappedResult = {};
			// Iterando sobre os nomes das colunas e criando um objeto com chave-valor
			result.metaData.forEach((column, index) => {
				mappedResult[column.name] = row[index];
			});
			// Enviando a resposta com os dados do produto mapeados
			res.json(mappedResult);
		} else {
			res.status(404).json({ error: "Produto não encontrado" });
		}
	} catch (err) {
		console.error("Erro ao consultar o banco de dados: ", err);
		res.status(500).json({ error: err.message });
	} finally {
		if (connection) {
			try {
				// Fechar a conexão com o banco
				await connection.close();
			} catch (err) {
				console.error("Erro ao fechar a conexão: ", err);
			}
		}
	}
});
