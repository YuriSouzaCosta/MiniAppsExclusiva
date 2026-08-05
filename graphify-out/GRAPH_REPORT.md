# Graph Report - PROJETO DOCKER  (2026-08-03)

## Corpus Check
- 118 files · ~197,115 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 750 nodes · 980 edges · 56 communities (47 shown, 9 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 112 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a2e38c61`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dependencies
- pos.js
- ocr_boleto.py
- faturamentoController.js
- orcamentoOCRController.js
- ESTRUTURA COMPLETA DO PROJETO — "PROJETO DOCKER"
- app.js
- pedidoComprasController.js
- requisicoesController.js
- detalhe.js
- scriptPedidos.js
- pdvController.js
- 6. Catálogo completo de rotas e endpoints
- nova.js
- scriptTransferencias.js
- ocr_processor.py
- baixaBoletosController.js
- contagemController.js
- authController.js
- scriptControlBuy.js
- CompilerPySIEG.py
- acompanhamentoNotasController.js
- authMiddleware.js
- ensureAuth
- acompanhamentoFinanceiroRoutes.js
- produtoRoutes.js
- analiseTransferenciasController.js
- script.js
- RESUMO DO PROJETO — "PROJETO DOCKER"
- baixaBoletosRoutes.js
- exportacaoRoutes.js
- transferenciasController.js
- lista.js
- acompanhamentoFinanceiroController.js
- oracle.js
- calculadoraCustoRoutes.js
- consultaProdutosController.js
- homeRoutes.js
- scriptAnaliseTransferencias.js
- controleCartaoController.js
- consultaController.js
- acompanhamentoNotasLiteRoutes.js
- consultaProdutosRoutes.js
- controleCartaoRoutes.js
- faturamentoRoutes.js
- analiseTransferenciasRoutes.js
- transferenciasRoutes.js
- create_user.js
- scriptPendencia.js
- run_ddl.js
- test_fin.js

## God Nodes (most connected - your core abstractions)
1. `6. Catálogo completo de rotas e endpoints` - 21 edges
2. `montar_dados()` - 16 edges
3. `ensureAuth()` - 14 edges
4. `ESTRUTURA COMPLETA DO PROJETO — "PROJETO DOCKER"` - 13 edges
5. `7. Controllers — funções exportadas` - 11 edges
6. `podeSeparar()` - 9 edges
7. `RESUMO DO PROJETO — "PROJETO DOCKER"` - 9 edges
8. `r2()` - 8 edges
9. `carregar()` - 8 edges
10. `carregaPedidosFeitos()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `postPdvLogin()` --calls--> `authenticatePdv()`  [EXTRACTED]
  controllers/pdvController.js → middleware/authMiddleware.js
- `postPdvLogin()` --calls--> `generateToken()`  [EXTRACTED]
  controllers/pdvController.js → middleware/authMiddleware.js

## Import Cycles
- None detected.

## Communities (56 total, 9 thin omitted)

### Community 0 - "dependencies"
Cohesion: 0.04
Nodes (48): bcrypt, body-parser, bootstrap-icons, cookie-parser, cors, dotenv, ejs, exceljs (+40 more)

### Community 1 - "pos.js"
Cohesion: 0.07
Nodes (45): allBrands, allPaymentMethods, cart, checkAndCreateHeader(), clientNameInput, closeBrandModal(), closeMobileCart(), closeModal() (+37 more)

### Community 2 - "ocr_boleto.py"
Cohesion: 0.07
Nodes (42): decode_barcode(), detectar_tipo(), get_ocr(), main(), montar_dados(), ocr_image(), page_native_text(), page_to_image() (+34 more)

### Community 3 - "faturamentoController.js"
Cohesion: 0.13
Nodes (28): anoAnterior(), apiDados(), apiHeatmap(), apiMetas(), apiMetaSet(), apiPainel(), apiStream(), apiVendedor() (+20 more)

### Community 4 - "orcamentoOCRController.js"
Cohesion: 0.07
Nodes (24): db, excelColToNum(), ExcelJS, executarPython(), fs, path, preencherExcel(), processarImagem() (+16 more)

### Community 5 - "ESTRUTURA COMPLETA DO PROJETO — "PROJETO DOCKER""
Cohesion: 0.06
Nodes (31): 10. Docker, 11. Tabelas / views do banco (Sankhya/Oracle), 12. Pontos de atenção / bugs conhecidos, 1. Visão geral, 2. Stack tecnológica, 3. Árvore de diretórios comentada, 4.1 Middlewares globais, 4.2 Proteção de rotas (+23 more)

### Community 6 - "app.js"
Cohesion: 0.07
Nodes (28): acompanhamentoFinanceiroRoutes, acompanhamentoNotasLiteRoutes, acompanhamentoNotasRoutes, analiseTransferenciasRoutes, app, authMiddleware, authRoutes, baixaBoletosRoutes (+20 more)

### Community 8 - "requisicoesController.js"
Cohesion: 0.13
Nodes (18): assumirSeparacao(), criarRequisicao(), db, detalhe(), empresaDoUsuario(), EMPRESAS_DESTINO, GRUPOS, index() (+10 more)

### Community 9 - "detalhe.js"
Cohesion: 0.16
Nodes (23): alterarParcial(), assumir(), cancelar(), carregar(), CLASSES, desenharBarra(), desenharCabecalho(), desenharItens() (+15 more)

### Community 10 - "scriptPedidos.js"
Cohesion: 0.13
Nodes (15): apagarPedido(), carregaPedidosFeitos(), carregarPedidos(), exportarPDF(), filtrarFormaPagamento(), filtrarFornecedor(), filtrarPedidosPorFornecedor(), fornDisponiveis (+7 more)

### Community 11 - "pdvController.js"
Cohesion: 0.10
Nodes (11): authMiddleware, db, getManagerDashboard(), getMyOrders(), getSalesDashboard(), moment, oracledb, authMiddleware (+3 more)

### Community 12 - "6. Catálogo completo de rotas e endpoints"
Cohesion: 0.10
Nodes (21): 6.10 Pedidos de Compra (`/` — paths de topo) — `pedidoComprasRoutes`, 6.11 Transferências (`/transferencias`) — `transferenciasRoutes`, 6.12 Análise de Transferências (`/analise-transferencias`) — `analiseTransferenciasRoutes`, 6.13 Requisições entre Lojas (`/requisicoes`) — `requisicoesRoutes`, 6.14 Orçamento OCR (`/orcamento-ocr`) — `orcamentoOCR.js`, 6.15 Faturamento (`/faturamento`) — `faturamentoRoutes`, 6.16 Acompanhamento de Notas (`/acompanhamento-notas`) — 👑 ADMIN, 6.17 Acompanhamento de Notas Lite (`/acompanhamento-notas-lite`) (+13 more)

### Community 13 - "nova.js"
Cohesion: 0.14
Nodes (18): adicionar(), alterarQtd(), atualizarRodape(), btnEnviar, buscar(), caixaResultados, campoBusca, campoDestino (+10 more)

### Community 14 - "scriptTransferencias.js"
Cohesion: 0.20
Nodes (12): adicionarItem(), buscarProduto(), carregarEstoque(), limparProduto(), listaTransferencias, locaisDestino, locaisOrigem, removerItem() (+4 more)

### Community 15 - "ocr_processor.py"
Cohesion: 0.19
Nodes (14): clean_description(), detect_horizontal_lines(), extract_items(), normalize_text(), parse_line(), parse_number(), process_image(), Detecta linhas horizontais na imagem usando OpenCV e retorna seus valores Y orde (+6 more)

### Community 16 - "baixaBoletosController.js"
Cohesion: 0.19
Nodes (11): apiBaixar(), apiUpload(), casarBoleto(), db, executarPythonBoleto(), fs, montarTitulo(), path (+3 more)

### Community 17 - "contagemController.js"
Cohesion: 0.15
Nodes (6): db, oracledb, authMiddleware, contagemController, express, router

### Community 18 - "authController.js"
Cohesion: 0.20
Nodes (8): authenticate(), db, generateToken(), jwt, postLogin(), authController, express, router

### Community 19 - "scriptControlBuy.js"
Cohesion: 0.27
Nodes (10): acoesNota, carregarNotasFiscais(), carregarNotasFiscais2(), carregarNotasFiscais3(), carregarNotasFiscais4(), carregarNotasFiscais5(), createToastContainer(), lojas (+2 more)

### Community 20 - "CompilerPySIEG.py"
Cohesion: 0.24
Nodes (11): extrair_dados_xml(), formatar_data(), gerar_planilha_importacao(), main(), processar_todas_empresas(), Processa todas as pastas e retorna DataFrame formatado para importação, Valida se os dados obrigatórios estão presentes, Gera a planilha no formato correto para importação (+3 more)

### Community 21 - "acompanhamentoNotasController.js"
Cohesion: 0.18
Nodes (4): db, path, TOP_ENTRADA, TOPS_SQL

### Community 22 - "authMiddleware.js"
Cohesion: 0.20
Nodes (8): postPdvLogin(), authenticatePdv(), db, generateToken(), jwt, authMiddleware, express, router

### Community 23 - "ensureAuth"
Cohesion: 0.18
Nodes (9): ensureAuth(), { ensureAuth }, express, pedidoComprasController, router, { ensureAuth }, express, requisicoesController (+1 more)

### Community 24 - "acompanhamentoFinanceiroRoutes.js"
Cohesion: 0.18
Nodes (9): requireRole(), ctrl, { ensureAuth, requireRole }, express, router, ctrl, { ensureAuth, requireRole }, express (+1 more)

### Community 25 - "produtoRoutes.js"
Cohesion: 0.20
Nodes (6): db, oracledb, authMiddleware, express, produtoController, router

### Community 26 - "analiseTransferenciasController.js"
Cohesion: 0.20
Nodes (3): db, oracledb, TODO: Ajustar query conforme estrutura real da tabela de transferências

### Community 27 - "script.js"
Cohesion: 0.27
Nodes (6): carregarContagens(), dropdownItems, dropdownToggle, exportarContagens(), salvarContagem(), zerarContagens()

### Community 28 - "RESUMO DO PROJETO — "PROJETO DOCKER""
Cohesion: 0.20
Nodes (9): 1. Stack Tecnológica, 2. Arquitetura, 3. Módulos da Aplicação, 4. Banco de Dados (Sankhya), 5. Docker, 6. Estado Atual (branch `PDV-EXC`), 7. Pontos de Atenção / Dívidas Técnicas, 8. Decisões Confirmadas (+1 more)

### Community 29 - "baixaBoletosRoutes.js"
Cohesion: 0.20
Nodes (9): ctrl, { ensureAuth, requireRole }, express, EXT_PERMITIDAS, multer, path, router, storageBoletos (+1 more)

### Community 30 - "exportacaoRoutes.js"
Cohesion: 0.22
Nodes (6): db, ExcelJS, authMiddleware, exportacaoController, express, router

### Community 32 - "lista.js"
Cohesion: 0.33
Nodes (8): atualizarContadores(), cacheRequisicoes, carregarLista(), CLASSES, desenharLista(), iniciarLista(), listaConfig, ROTULOS

### Community 33 - "acompanhamentoFinanceiroController.js"
Cohesion: 0.29
Nodes (6): apiDados(), db, path, TOP_ENTRADA, TOPS_SQL, validData()

### Community 34 - "oracle.js"
Cohesion: 0.38
Nodes (5): close(), getConnection(), oracledb, simpleExecute(), util

### Community 35 - "calculadoraCustoRoutes.js"
Cohesion: 0.29
Nodes (4): calculadoraCustoController, { ensureAuth }, express, router

### Community 37 - "homeRoutes.js"
Cohesion: 0.29
Nodes (4): authMiddleware, express, homeController, router

### Community 38 - "scriptAnaliseTransferencias.js"
Cohesion: 0.48
Nodes (5): carregarAnalisePorLocal(), carregarAnalisePorProduto(), carregarTransferenciasFinalizadas(), carregarTransferenciasPendentes(), setupTabListeners()

### Community 41 - "acompanhamentoNotasLiteRoutes.js"
Cohesion: 0.40
Nodes (4): ctrl, { ensureAuth }, express, router

### Community 42 - "consultaProdutosRoutes.js"
Cohesion: 0.40
Nodes (4): consultaProdutosController, { ensureAuth }, express, router

### Community 43 - "controleCartaoRoutes.js"
Cohesion: 0.40
Nodes (4): controleCartaoController, { ensureAuth }, express, router

### Community 44 - "faturamentoRoutes.js"
Cohesion: 0.40
Nodes (4): { ensureAuth }, express, faturamentoController, router

### Community 45 - "analiseTransferenciasRoutes.js"
Cohesion: 0.40
Nodes (4): analiseTransferenciasController, { ensureAuth }, express, router

### Community 46 - "transferenciasRoutes.js"
Cohesion: 0.40
Nodes (4): { ensureAuth }, express, router, transferenciasController

## Knowledge Gaps
- **297 isolated node(s):** `express`, `bodyParser`, `cookieParser`, `path`, `cors` (+292 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ensureAuth()` connect `ensureAuth` to `calculadoraCustoRoutes.js`, `orcamentoOCRController.js`, `acompanhamentoNotasLiteRoutes.js`, `consultaProdutosRoutes.js`, `controleCartaoRoutes.js`, `faturamentoRoutes.js`, `analiseTransferenciasRoutes.js`, `transferenciasRoutes.js`, `authMiddleware.js`, `acompanhamentoFinanceiroRoutes.js`, `baixaBoletosRoutes.js`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `ESTRUTURA COMPLETA DO PROJETO — "PROJETO DOCKER"` connect `ESTRUTURA COMPLETA DO PROJETO — "PROJETO DOCKER"` to `6. Catálogo completo de rotas e endpoints`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `express`, `bodyParser`, `cookieParser` to the rest of the system?**
  _297 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `pos.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0726950354609929 - nodes in this community are weakly interconnected._
- **Should `ocr_boleto.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07308970099667775 - nodes in this community are weakly interconnected._
- **Should `faturamentoController.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1268939393939394 - nodes in this community are weakly interconnected._