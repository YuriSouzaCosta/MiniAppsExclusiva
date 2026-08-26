# ESTRUTURA COMPLETA DO PROJETO — "PROJETO DOCKER"

> Portal web interno da **Exclusiva Utilidades**, integrado ao ERP **Sankhya (Oracle Database)**.
> Node.js/Express + EJS, containerizado com Docker. Documento gerado em **31/07/2026** (branch `ModuloTransferencia`).

---

## 1. Visão geral

Aplicação **MVC simples** que serve como *portal central de acesso* a vários módulos operacionais:

| Módulo | Rota base | Status |
|---|---|---|
| Central de Acessos (menu) | `/` | ✅ ativo |
| Login / Autenticação | `/login` | ✅ ativo |
| PDV (Ponto de Venda) | `/pdv` | ✅ ativo (login próprio) |
| Pedidos de Compra | `/pedidosCompras` e derivados | ✅ ativo |
| Requisições entre Lojas | `/requisicoes` | ✅ ativo (desenvolvimento recente) |
| Transferências | `/transferencias` | ✅ ativo |
| Análise de Transferências | `/analise-transferencias` | ⚠️ preliminar (tabela não-real) |
| Orçamento OCR | `/orcamento-ocr` | ✅ ativo |
| Faturamento por Vendedor | `/faturamento` | ✅ ativo |
| Acompanhamento de Notas | `/acompanhamento-notas` e `-lite` | ✅ ativo (somente ADMIN) |
| Acompanhamento Financeiro | `/acompanhamento-financeiro` | ✅ ativo (somente ADMIN) |
| Contagem de Estoque | `/contagem` | ✅ ativo (API/coletor) |
| Consulta de Produtos | `/consulta-produtos` | ✅ ativo |
| Controle de Cartões | `/controle-cartao` | ✅ ativo |
| Calculadora de Custo | `/calculadora-custo` | ✅ ativo |
| Coletor | `/coletor` | ✅ ativo |
| Consulta Gertec / EAN | `/gertec/:codbarra`, `/consulta-ean` | ✅ ativo (público) |
| ControlCompras (views) | — | ❌ embrião abandonado (sem rotas) |
| Pendência Fornecedores (views) | — | ❌ órfãs (sem rotas) |

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 18 + Express 4 |
| Views | EJS (server-side) + Bootstrap 5 (CDN) + SweetAlert2 |
| Banco | Oracle (ERP Sankhya) via `oracledb` 5.3 + Instant Client 19.19 |
| Auth | JWT em cookie (`auth_token`), senha validada contra `TSIUSU.AD_SENHA` |
| OCR | Python 3 + PaddleOCR + OpenCV (`python/ocr_processor.py` via `spawn`) |
| Planilhas | ExcelJS (`exceljs`) / `xlsx` |
| Container | Docker (`node:18-bullseye-slim`) + docker-compose, porta 3000 |

Dependências em `package.json`: `express`, `ejs`, `oracledb`, `jsonwebtoken`, `cookie-parser`, `body-parser`, `cors`, `dotenv`, `multer`, `exceljs`, `xlsx`, `moment`, `bcrypt`, `bootstrap-icons`, `sqlite3`.
(⚠️ `fs`, `path`, `upload`, `projeto: file:` são dependências desnecessárias.)

---

## 3. Árvore de diretórios comentada

```
PROJETO DOCKER/
├── app.js                        → bootstrap do Express (middlewares, rotas, pool Oracle, listen :3000)
├── package.json                  → dependências npm
├── Dockerfile                    → imagem Node 18 + Oracle Instant Client + python3
├── docker-compose.yml            → serviço "app" porta 3000, volume ./data, env_file .env
├── .env                          → credenciais Oracle, JWT_SECRET, COOKIE_NAME, NODE_ENV (local)
├── .gitignore / .dockerignore    → ignoram node_modules, .env, uploads, __pycache__
├── RESUMO.md                     → resumo anterior do projeto (parcialmente desatualizado)
├── ESTRUTURA.md                  → este documento
│
├── config/
│   └── db/
│       └── oracle.js             → pool oracledb (poolMin 1, poolMax 4) + helper simpleExecute()
│
├── middleware/
│   └── authMiddleware.js         → authenticate (TSIUSU), authenticatePdv, generateToken,
│                                   ensureAuth (JWT em cookie), requireRole(...roles)
│
├── routes/                       → rotas por módulo (ver seção 6)
│   ├── authRoutes.js
│   ├── homeRoutes.js
│   ├── coletorRoutes.js
│   ├── produtoRoutes.js
│   ├── contagemRoutes.js
│   ├── exportacaoRoutes.js
│   ├── controleCartaoRoutes.js
│   ├── calculadoraCustoRoutes.js
│   ├── consultaProdutosRoutes.js
│   ├── pdvRoutes.js
│   ├── faturamentoRoutes.js
│   ├── acompanhamentoNotasRoutes.js
│   ├── acompanhamentoNotasLiteRoutes.js
│   ├── acompanhamentoFinanceiroRoutes.js
│   ├── orcamentoOCR.js
│   ├── pedidos/pedidoComprasRoutes.js
│   ├── requisicoes/requisicoesRoutes.js
│   └── transferencias/
│       ├── transferenciasRoutes.js
│       └── analiseTransferenciasRoutes.js
│
├── controllers/                  → lógica de negócio + SQL direto no Oracle (ver seção 7)
│   ├── authController.js
│   ├── homeController.js
│   ├── coletorController.js
│   ├── produtoController.js
│   ├── contagemController.js
│   ├── exportacaoController.js
│   ├── controleCartaoController.js
│   ├── calculadoraCustoController.js
│   ├── consultaProdutosController.js
│   ├── consultaController.js      → Gertec/EAN
│   ├── pdvController.js
│   ├── faturamentoController.js
│   ├── acompanhamentoNotasController.js
│   ├── acompanhamentoFinanceiroController.js
│   ├── orcamentoOCRController.js
│   ├── 
.js       → vazio (0 linhas)
│   ├── pedidos/pedidoComprasController.js
│   ├── requisicoes/requisicoesController.js
│   └── transferencias/
│       ├── transferenciasController.js
│       └── analiseTransferenciasController.js
│
├── views/                        → páginas EJS (e .html estáticos) por módulo (ver seção 8)
│
├── public/                       → estáticos servidos em /css, /js, /images
│   ├── css/                      → calculadoraCusto, consultaProdutos, controleCartao, login,
│   │                               pdv-mobile, requisicoes, responsive, style, styleDashboard
│   ├── js/                       → script.js, create_user.js, scriptControlBuy.js,
│   │                               scriptPendencia.js, scriptHistorico.js
│   │   ├── pdv/pos.js
│   │   ├── pedidos/scriptPedidos.js
│   │   ├── requisicoes/{detalhe,lista,nova}.js
│   │   └── transferencias/{scriptTransferencias,scriptAnaliseTransferencias}.js
│   └── images/                   → logo.png, logo_branca.png, logo.jpeg
│
├── python/
│   ├── ocr_processor.py          → script standalone PaddleOCR (JSON no stdout)
│   └── requirements.txt          → paddlepaddle, paddleocr, Pillow
│
├── uploads/                      → runtime (não versionado)
│   ├── imagens/                  → fotos de orçamento enviadas
│   ├── modelos/                  → templates .xlsx cadastrados
│   └── processados/              → planilhas .xlsx geradas pelo OCR
│
├── data/
│   └── metas.json                → metas de faturamento (persistido via volume Docker)
│
├── css/                          → style.css (duplicado na raiz) — lixo, pode remover
├── index.html                    → lixo, pode remover
├── pdv/                          → só node_modules — lixo, pode remover
├── scratch/test_fin.js           → script de teste avulso
└── .claude/  .vscode/  graphify-out/  → configurações e grafo de conhecimento do projeto
```

---

## 4. Bootstrap — `app.js`

### 4.1 Middlewares globais
```js
app.use(cors());                        // libera CORS
app.use(bodyParser.json());             // JSON
app.use(bodyParser.urlencoded({extended:true}));  // formulários
app.use(cookieParser());                // cookies (lê o JWT)
app.use(express.static('public'));      // arquivos estáticos
app.set('view engine', 'ejs');          // EJS
app.set('views', 'views');
```

### 4.2 Proteção de rotas
1. `app.use('/', authRoutes)` monta **login/logout públicos**.
2. Middleware global: rotas cujo path começa com `/login`, `/css`, `/js`, `/public`, `/auth`, `/coletor`, `/gertec`, `/favicon.ico`, `/consulta-ean` passam; **todo o resto exige `ensureAuth`** (redireciona para `/login` ou `/pdv/login`).
3. Depois são montados todos os routers dos módulos.

### 4.3 Montagem dos routers (ordem = ordem de `app.use`)

| Path montado | Router |
|---|---|
| `/` | `authRoutes` |
| `/` | rota GET `/` → renderiza `menu.ejs` (Central de Acessos) |
| `/` | `coletorRoutes` ⚠️ (montado 2× em `app.js` — duplicado) |
| `/produto` | `produtoRoutes` |
| `/contagem` | `contagemRoutes` |
| `/exportacao` | `exportacaoRoutes` |
| `/controle-cartao` | `controleCartaoRoutes` |
| `/calculadora-custo` | `calculadoraCustoRoutes` |
| `/consulta-produtos` | `consultaProdutosRoutes` |
| `/` | `pedidoComprasRoutes` |
| `/transferencias` | `transferenciasRoutes` |
| `/analise-transferencias` | `analiseTransferenciasRoutes` |
| `/requisicoes` | `requisicoesRoutes` |
| `/orcamento-ocr` | `orcamentoOCRRoutes` |
| `/faturamento` | `faturamentoRoutes` |
| `/acompanhamento-notas` | `acompanhamentoNotasRoutes` |
| `/acompanhamento-notas-lite` | `acompanhamentoNotasLiteRoutes` |
| `/acompanhamento-financeiro` | `acompanhamentoFinanceiroRoutes` |
| `/` | `homeRoutes` |
| `/pdv` | `pdvRoutes` |
| (direto) | `GET /gertec/:codbarra` → `consultaGertec` |
| (direto) | `GET /consulta-ean` → `consultaEanPhp` |

> **Rota raiz `/` (menu):** renderiza `menu.ejs` com `{ user, minhaVariavel }`, onde `minhaVariavel` é a URL base detectada (localhost/porta em dev, `https://appexclusiva.innube.com.br` em produção). O menu é uma **Central de Acessos** com cards por categoria (Vendas e PDV, Estoque e lojas, Produtos e preços, Compras, Fiscal e notas, Financeiro), busca por nome e favoritos salvos em `localStorage`.

---

## 5. Autenticação — `middleware/authMiddleware.js`

As permissões de `AD_TELAS_PERMISSOES` controlam tanto os cards da Central de Acessos quanto as rotas e APIs. Uma tela ainda não configurada usa as roles padrão de `config/screenPermissions.js`; salvar a tela sem nenhuma role cria um bloqueio explícito para todos, exceto `ADMIN`.

| Função | O que faz |
|---|---|
| `authenticate(user, pass)` | Busca em `TSIUSU` (NOMEUSU, AD_SENHA, AD_ROLE); compara **senha em texto puro** (campo custom do Sankhya — sem hash); resolve o nome legível da role em `TDDOPC` (`NUCAMPO = 9999990154`). Retorna `{username, role, roleName}`. |
| `authenticatePdv(user, pass)` | Busca em `VW_LISTFUNCIONARIOS_VENDAS_YSC` (APELIDO, AD_SENHA, TIPVEND, CODVEND, CODEMP); mapeia `TIPVEND` `V/G/C` → `VENDEDOR/GERENTE/ADMIN`. |
| `generateToken(payload)` | `jwt.sign` com `JWT_SECRET`, expiração `JWT_EXPIRES` (default 7d). |
| `ensureAuth` | Lê cookie `COOKIE_NAME` (`auth_token`), verifica JWT e injeta `req.user`. Sem token/ inválido → redireciona `/login` (ou `/pdv/login` se a rota começa com `/pdv`). |
| `requireRole(...roles)` | Bloqueia com 403 se `req.user.role` não estiver entre as permitidas. |

> ⚠️ **Segurança:** `authenticate`/`authenticatePdv` imprimem a senha no `console.log`. Recomendado remover.

---

## 6. Catálogo completo de rotas e endpoints

Legenda: 🔓 público (sem login) · 🔒 exige login · 👑 só ADMIN

### 6.1 Autenticação (`/`) — `authRoutes`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/login` | inline | 🔓 Renderiza `login.ejs` |
| POST | `/login` | `authController.postLogin` | 🔓 Autentica, grava JWT no cookie, redireciona `/` |
| POST | `/logout` | `authController.postLogout` | 🔒 Limpa cookie e redireciona `/login` |

### 6.2 Menu / Home (`/`)
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/` | inline (app.js) | 🔒 Renderiza `menu.ejs` (Central de Acessos) |
| GET | `/home` | `homeController.home` | 🔒 Renderiza `pages/home` ⚠️ **view não existe** (rota quebrada) |

### 6.3 Coletor (`/`) — `coletorRoutes`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/coletor` | inline | 🔒 Renderiza `coletor.ejs`. (Listada como pública no `app.js`, mas a rota tem `ensureAuth` — na prática exige login) |

### 6.4 Produtos (`/produto`) — `produtoRoutes`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/produto/:codigo_barra` | `produtoController.getProdutoByCodigo` | 🔒 Busca produto por código de barras (`VW_PRODUTOS_BLC`). JSON |
| POST | `/produto/contagem` | `produtoController.postContagem` | 🔒 Insere contagem (`AD_CONTAGENS`). JSON |

### 6.5 Contagem (`/contagem`) — `contagemRoutes`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| POST | `/contagem/` | `createContagem` | 🔒 Insere contagem, retorna id |
| GET | `/contagem/` | `listContagens` | 🔒 Lista pendentes do usuário (header `Authorization`) |
| GET | `/contagem/:usuario` | `getContagensByUsuario` | 🔒 Lista pendentes por usuário (rota) |
| POST | `/contagem/:usuario` | `deleteContagensByUsuario` | 🔒 Soft delete (SITUACAO='E') |
| PUT | `/contagem/:id` | `updateQuantidade` | 🔒 Atualiza quantidade |

### 6.6 Exportação (`/exportacao`) — `exportacaoRoutes`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/exportacao/exportar/:usuario` | `exportarContagens` | 🔒 Gera `.xlsx` (ExcelJS) com as contagens do usuário e envia como download |

### 6.7 Controle de Cartão (`/controle-cartao`) — `controleCartaoRoutes`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/controle-cartao/` | `index` | 🔒 Redireciona `/controle-cartao/novo` |
| GET | `/controle-cartao/novo` | `create` | 🔒 Renderiza `controleCartao/novo.ejs` (formulário) |
| POST | `/controle-cartao/novo` | `store` | 🔒 Grava solicitação (`AD_SOLICITACAO`, situação PENDENTE) |
| GET | `/controle-cartao/pendentes` | `listPending` | 🔒 Lista pendentes (`AD_SOLICITACAO` + `AD_CARTOES`) |

### 6.8 Calculadora de Custo (`/calculadora-custo`) — `calculadoraCustoRoutes`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/calculadora-custo/` | `index` | 🔒 Renderiza `calculadoraCusto/index.ejs` |

### 6.9 Consulta de Produtos (`/consulta-produtos`) — `consultaProdutosRoutes`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/consulta-produtos/` | `index` | 🔒 Renderiza `consultaProdutos/index.ejs` (versão com custo) |
| GET | `/consulta-produtos/vendedor` | `index` | 🔒 Mesma view (versão vendedor, sem custo) |
| GET | `/consulta-produtos/api/marcas` | `getMarcas` | 🔒 Marcas (`TGFMAR`) |
| GET | `/consulta-produtos/api/produtos` | `searchProducts` | 🔒 Busca por marca/termo (`VW_CONSULTA_SITE_YSC`) |
| GET | `/consulta-produtos/api/estoque` | `getStock` | 🔒 Estoque por empresa (`VW_CONSULTA_SITE_YSC`) |

### 6.10 Pedidos de Compra (`/` — paths de topo) — `pedidoComprasRoutes`
**Views:**
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/pedidosCompras` | `index` | 🔒 Tela principal (`pedidos/pedidoCompras.ejs`) |
| GET | `/listaPedidos` | `listaPedidos` | 🔒 Listagem (`pedidos/listaPedidos.ejs`) |
| GET | `/fazerPedidos` | `fazerPedidos` | 🔒 Criação/edição (`pedidos/fazerPedidos.ejs`) |
| GET | `/finalizarPedidos` | `finalizarPedidos` | 🔒 Finalização (`pedidos/finalizarPedidos.ejs`) |
| GET | `/pedidosFinalizados` | `pedidosFinalizados` | 🔒 Pedidos fechados (`pedidos/pedidoFinalizados.ejs`) |
| GET | `/painel` | `painelPedidos` | 🔒 Painel/dashboard (`pedidos/painelPedidos.ejs`) |

**APIs:**
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/carregarMarcas` | `carregarMarcas` | 🔒 Marcas (`TGFMAR`) |
| GET | `/carregarFornecedores` | `carregarFornecedores` | 🔒 Fornecedores (`TGFPAR`, FORNECEDOR='S') |
| GET | `/carregarFormaPagamentos` | `carregarFormaPagamentos` | 🔒 Formas de pagamento (`TGFTPV`) |
| POST | `/criarPedido` | `criarPedido` | 🔒 Cria cabeçalho em `CABECALHO_PEDIDO_YSC` (mapeia grupo EXCLUSIVA/PRIME/SITE). ⚠️ bug: `emp` sem declaração |
| GET | `/consultarPedidos` | `consultarPedidos` | 🔒 Pedidos `ANDAMENTO='ABERTO'` |
| GET | `/consultarPedidosFeitos` | `consultarPedidosFeitos` | 🔒 Pedidos `ANDAMENTO='FEITO'` |
| GET | `/consultarPedidosCompleto` | `consultarPedidosCompleto` | 🔒 Pedidos `ANDAMENTO='FINALIZADO'` |
| GET | `/loadPedidos` | `loadPedidos` | 🔒 Itens de um pedido (`PEDIDO_PROCESSADO_YSC`) |
| DELETE | `/fecharPedido` | `fecharPedido` | 🔒 Exclui pedido por `NUMERO_PEDIDO` |
| POST | `/finalizarPedidoFinal` | `finalizarPedidoFinal` | 🔒 Finaliza e chama procedure `STP_GERARPEDCOMPRA_IMPORT_YSC` (com retry ORA-01422) |
| GET | `/exportarPdf` | `exportarPdf` | 🔒 Dados p/ PDF (join processado + cabeçalho) |
| POST | `/salvarPedidos` | `salvarPedidos` | 🔒 Atualiza QTD_PEDIR/VLR_TOTAL em lote (`executeMany`) |
| POST | `/atualizarPedidoFeito` | `atualizarPedidoFeito` | 🔒 Marca como FEITO (CODEMP, DATAS, VLRTOTAL) |
| GET | `/carregarItensSankhya` | `carregarItensSankhya` | 🔒 Itens da nota por NUNOTA (`TGFITE`+`TGFPRO`) |
| POST | `/salvarItensSankhya` | `salvarItensSankhya` | 🔒 Grava preços editados em `TGFITE`/`TGFCAB` |
| POST | `/finalizarPedidoComValores` | `finalizarPedidoComValores` | 🔒 Fluxo completo: finaliza + sincroniza + procedure + ajusta preços + busca NUNOTA |
| POST | `/reprocessar-pedido/:id` | `reprocessarPedido` | 🔒 Duplica pedido finalizado e regenera lançamento |
| GET | `/api/painel-dados` | `getPainelDados` | 🔒 Notas de compra pendentes (PRAZO/ATRASADO/CRITICO) |

### 6.11 Transferências (`/transferencias`) — `transferenciasRoutes`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/transferencias/` | `index` | 🔒 Renderiza `transferencias/index.ejs` |
| GET | `/transferencias/api/produto/:codigoBarras` | `buscarProduto` | 🔒 Busca produto (`VW_CONSULTA_SITE_YSC`; apesar do nome, **não** consulta `TGFBAR`) |
| GET | `/transferencias/api/estoque/:codProd` | `buscarEstoque` | 🔒 Locais de origem com saldo (`VW_MIRROR_EST_YSC`) |
| GET | `/transferencias/api/locais-destino` | `buscarLocaisDestino` | 🔒 Locais/empresas disponíveis como destino |
| POST | `/transferencias/api/criarTransferencias` | `criarTransferencias` | 🔒 Lote de transferências via procedure `STP_CRIAR_TRANSFERENCIA_YSC` (erro individual não derruba o lote) |
| GET | `/transferencias/api/puxarTransferencias` | `puxarTransferencias` | 🔒 Transferências pendentes (`VW_MIRROR_TRANS_YSC`, `AD_TRANSF_YSC='S'`) |

### 6.12 Análise de Transferências (`/analise-transferencias`) — `analiseTransferenciasRoutes`
> Dashboard consolidado baseado em `TGFCAB` + `TGFITE`, filtrando as TOPs `7000` e `7001`, somente itens com `SEQUENCIA > 0`, custo gravado em `TGFITE.CUSTO`, sem o fan-out da view antiga por local e desconsiderando transferências dentro do mesmo grupo empresarial. Inclui conferência por nota, produto, quantidade, custo unitário e custo total.
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/analise-transferencias/` | `index` | 🔒 Renderiza `analise-transferencias/index.ejs` |
| GET | `/analise-transferencias/api/dashboard` | `dashboard` | 🔒 Fluxos das TOPs 7000/7001 por grupos Exclusiva (1/3), Prime (2/4/7), Site (5) e Decora (6), com saldo pelo custo |
| GET | `/analise-transferencias/api/pendentes` | `buscarTransferenciasPendentes` | 🔒 STATUS='PENDENTE' |
| GET | `/analise-transferencias/api/finalizadas` | `buscarTransferenciasFinalizadas` | 🔒 STATUS='FINALIZADA' paginado (`ROW_NUMBER`) |
| GET | `/analise-transferencias/api/analise-periodo` | `buscarAnalisePorPeriodo` | 🔒 Agrega por dia (dataInicio/dataFim) |
| GET | `/analise-transferencias/api/analise-produto` | `buscarAnalisePorProduto` | 🔒 Agrega por produto |
| GET | `/analise-transferencias/api/analise-local` | `buscarAnalisePorLocal` | 🔒 Agrega por par origem/destino |

### 6.13 Requisições entre Lojas (`/requisicoes`) — `requisicoesRoutes`
**APIs:**
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/requisicoes/api/produtos` | `buscarProdutos` | 🔒 Autocomplete/busca (VW_CONSULTA_SITE_YSC + TGFBAR + VW_MIRROR_EST_YSC). usa bind `:termoLike` (ORA-01745) |
| GET | `/requisicoes/api/requisicoes` | `listarRequisicoes` | 🔒 Lista (escopo `fila` exige permissão de separação) |
| POST | `/requisicoes/api/requisicoes` | `criarRequisicao` | 🔒 Cria cabeçalho + itens (`AD_REQ_CAB_YSC`/`AD_REQ_ITE_YSC`, sequence `AD_REQ_CAB_SEQ`), transação |
| GET | `/requisicoes/api/requisicoes/:num` | `obterRequisicao` | 🔒 Cabeçalho + itens + saldo do grupo |
| POST | `/requisicoes/api/requisicoes/:num/assumir` | `assumirSeparacao` | 🔒 Trava a separação ("quem chega primeiro segura") |
| PUT | `/requisicoes/api/requisicoes/:num/itens` | `salvarItens` | 🔒 Marca TEM/PARCIAL/FALTA por item |
| POST | `/requisicoes/api/requisicoes/:num/liberar` | `liberarRequisicao` | 🔒 **Ponto central**: rateia itens, chama `STP_TRANSF_REQUISICAO_YSC` por empresa origem, gera notas |
| POST | `/requisicoes/api/requisicoes/:num/receber` | `confirmarRecebimento` | 🔒 Marca RECEBIDA |
| POST | `/requisicoes/api/requisicoes/:num/cancelar` | `cancelarRequisicao` | 🔒 Cancela (dono ou ADMIN, só ABERTA) |
| DELETE | `/requisicoes/api/requisicoes/:num` | `excluirRequisicao` | 🔒 Exclui inteira (itens por ON DELETE CASCADE); se gerou NUNOTA só ADMIN com `?forcar=1` |
| DELETE | `/requisicoes/api/requisicoes/:num/itens/:seq` | `excluirItem` | 🔒 Exclui item específico |

**Views:**
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/requisicoes/` | `index` | 🔒 Tela principal (`requisicoes/index.ejs`) |
| GET | `/requisicoes/nova` | `nova` | 🔒 Formulário (`requisicoes/nova.ejs`) |
| GET | `/requisicoes/separacao` | `separacao` | 🔒 Fila de separação (ESTOQUISTA/ADMIN/GERENTE; 403 = `sem-acesso.ejs`) |
| GET | `/requisicoes/:num(\\d+)` | `detalhe` | 🔒 Detalhe (`requisicoes/detalhe.ejs`, dados via API) |

### 6.14 Orçamento OCR (`/orcamento-ocr`) — `orcamentoOCR.js`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/orcamento-ocr/` | `index` | 🔒 Renderiza `orcamento-ocr/index.ejs` |
| GET | `/orcamento-ocr/modelos` | `listarModelos` | 🔒 Modelos ativos (`AD_OCR_MODELOS`) |
| GET | `/orcamento-ocr/historico` | `listarHistorico` | 🔒 Últimos 50 processamentos |
| POST | `/orcamento-ocr/upload-modelo` | `uploadModelo` | 🔒 Upload de template .xlsx (multer, valida ExcelJS) |
| POST | `/orcamento-ocr/processar` | `processarImagem` | 🔒 OCR da imagem (multer + spawn python) → preenche Excel (`uploads/processados`) |
| GET | `/orcamento-ocr/download/:arquivo` | `downloadArquivo` | 🔒 Baixa planilha gerada (`path.basename` anti path-traversal) |
| DELETE | `/orcamento-ocr/modelo/:id` | `deletarModelo` | 🔒 Soft delete (ATIVO=0) + remove arquivo |

### 6.15 Faturamento (`/faturamento`) — `faturamentoRoutes`
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/faturamento/` | `paginaIndex` | 🔒 `sendFile` `faturamento/index.html` (análise por vendedor) |
| GET | `/faturamento/painel` | `paginaPainel` | 🔒 `sendFile` `painel.html` (painel TV/mobile) |
| GET | `/faturamento/vendedor` | `paginaVendedor` | 🔒 `sendFile` `vendedor.html` |
| GET | `/faturamento/marcas` | `paginaMarcas` | 🔒 Faturamento por marca com filtros múltiplos de empresa, marca, linha, vendedor e produto |
| GET | `/faturamento/api/filtros` | `apiFiltros` | 🔒 Empresas com faturamento (`TSIEMP` + subquery `TGFCAB`) |
| GET | `/faturamento/api/dados` | `apiDados` | 🔒 Faturamento por vendedor (bruto, devolução, líquido) com **rateio de vendas divididas** (`TGFCCM.PERCCOM`) |
| GET | `/faturamento/api/painel` | `apiPainel` | 🔒 Igual ao `apiDados` + mesmo período do ano anterior (YoY) |
| GET | `/faturamento/api/stream` | `apiStream` | 🔒 **SSE**: notifica o painel quando o faturamento muda (sentinela `TGFCAB`, polling 5s) |
| GET | `/faturamento/api/heatmap` | `apiHeatmap` | 🔒 Heatmap dia-da-semana × hora |
| GET | `/faturamento/api/vendedor` | `apiVendedor` | 🔒 Totais + série diária de um vendedor |
| GET | `/faturamento/api/marcas` | `apiMarcas` | 🔒 Relatório por marca/linha, detalhado por vendedor e com filtro de CODPROD |

### 6.15.1 Compras por Marca (`/compras-marcas`)

| Método | Rota | Handler | Descrição |
|---|---|---|---|
| GET | `/compras-marcas/` | `pagina` | 🔒 Relatório de compras por marca e linha |
| GET | `/compras-marcas/api/filtros` | `apiFiltros` | 🔒 Empresas com compras liberadas |
| GET | `/compras-marcas/api/dados` | `apiDados` | 🔒 Compras TOP 5/6 com filtros múltiplos e detalhamento por fornecedor |
| GET | `/faturamento/api/metas` | `apiMetas` | 🔒 Lê `data/metas.json` |
| POST | `/faturamento/api/meta` | `apiMetaSet` | 🔒 Salva/remove meta em `data/metas.json` |

### 6.16 Acompanhamento de Notas (`/acompanhamento-notas`) — 👑 ADMIN
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/acompanhamento-notas/` | `paginaIndex` | 👑 `sendFile` `acompanhamentoNotas/index.html` |
| GET | `/acompanhamento-notas/api/dados` | `apiDados` | 👑 Notas do Portal (`TGFIXN`) cruzadas com lançamento (`TGFCAB`), financeiro (`TGFFIN`) e carimbo `AD_NOTA_CHEGADA` |
| GET | `/acompanhamento-notas/api/itens` | `apiItens` | 👑 Itens da nota lendo o **XML da NF-e** da `TGFIXN` via `XMLTABLE` com `local-name()` |
| POST | `/acompanhamento-notas/api/chegada` | `marcarChegada` | 👑 Carimba/remove "Chegou" (`AD_NOTA_CHEGADA`, MERGE) |

### 6.17 Acompanhamento de Notas Lite (`/acompanhamento-notas-lite`)
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/acompanhamento-notas-lite/` | `paginaIndexLite` | 🔒 `sendFile` `indexLite.html` (versão mobile, só fila) |
| GET | `/acompanhamento-notas-lite/api/dados` | `apiDadosLite` | 🔒 Somente notas **não lançadas** |
| GET | `/acompanhamento-notas-lite/api/itens` | `apiItens` | 🔒 Itens da nota (modal) |

### 6.18 Acompanhamento Financeiro (`/acompanhamento-financeiro`) — 👑 ADMIN
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/acompanhamento-financeiro/` | `paginaIndex` | 👑 `sendFile` `acompanhamentoFinanceiro/index.html` |
| GET | `/acompanhamento-financeiro/api/dados` | `apiDados` | 👑 Títulos a pagar (`TGFFIN` RECDESP=-1) por parcela, com vencimento no período |

### 6.19 PDV (`/pdv`) — `pdvRoutes`
**Login (público):**
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/pdv/login` | `getPdvLogin` | 🔓 Renderiza `pdv/login.ejs` |
| POST | `/pdv/login` | `postPdvLogin` | 🔓 Autentica (TGFVEN), JWT no cookie httpOnly; redireciona `/pdv/manager` (ADMIN/GERENTE) ou `/pdv/sales` (VENDEDOR) |

**Telas (logado):**
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/pdv/manager` | `getManagerDashboard` | 🔒 Dashboard gerencial (métricas, top vendedores, gráfico 7 dias, filtro empresa/período) |
| GET | `/pdv/sales` | `getSalesDashboard` | 🔒 Dashboard do vendedor (vendas do dia/período, metas fixas 5000/100000) |
| GET | `/pdv/pos` | `getNewOrder` | 🔒 Formulário de novo pedido |
| GET | `/pdv/my-orders` | `getMyOrders` | 🔒 Pedidos do usuário (filtro por papel/período/status) |

**APIs:**
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| POST | `/pdv/create-header` | `createOrderHeader` | 🔒 Cria cabeçalho via procedure `STP_GERARCABVENDA_IMPORT_YSC`, retorna NUNOTA, força CODVEND |
| POST | `/pdv/order` | `postOrder` | 🔒 Insere itens (`TGFITE`) e atualiza total (`TGFCAB`). ⚠️ bug: INSERT com vírgula sobrando |
| GET | `/pdv/products` | `searchProducts` | 🔒 Busca de produtos (termo ≥3 chars, `VW_CONSULTA_SITE_YSC`) |
| GET | `/pdv/marcas` | `getMarcas` | 🔒 Marcas (`TGFMAR`) |
| GET | `/pdv/partners` | `searchPartners` | 🔒 Parceiros/clientes (`vw_listParceiros_vendas_ysc`, ROWNUM≤20). ⚠️ rota declarada 2× |
| GET | `/pdv/payment-methods` | `getPaymentMethods` | 🔒 Formas de pagamento por tipo (à vista/cartão/boleto) |
| GET | `/pdv/order-details` | `getOrderDetails` | 🔒 Detalhe do pedido (header + itens). ⚠️ duplica chave `nunota` |

### 6.20 Gertec / EAN (direto no `app.js`) — 🔓 público
| Método | Rota | Controller | Descrição |
|---|---|---|---|
| GET | `/gertec/:codbarra` | `consultaController.consultaGertec` | 🔓 Consulta de preço p/ display Gertec — retorna **text/plain** em 2 linhas de 20 caracteres (`TGFPRO` + `SNK_PRECO`) |
| GET | `/consulta-ean` | `consultaController.consultaEanPhp` | 🔓 Consulta por EAN com preço e custos (`SNK_PRECO`, `YSC_PUXACUSTO_EXC`, `YSC_PUXACUSTO_S_IPI_EXC`) |

> A 3ª função de `consultaController` (`consultaProduto`, genérica) **não está amarrada a nenhuma rota**.

---

## 7. Controllers — funções exportadas

### `pdvController.js` (13 exports)
| Função | O que faz |
|---|---|
| `getManagerDashboard` | Dashboard gerencial; `vw_listPedidos_vendas_ysc` + `VW_LISTFUNCIONARIOS_VENDAS_YSC`; TOPs 3105/3106/3199/3200/3202/3204, STATUSNOTA='L'; ADMIN vê todos gerentes, GERENTE filtra o próprio CODGER |
| `getSalesDashboard` | Dashboard do vendedor; vendas do dia + pendências (TOP9) via UNION ALL; metas fixas |
| `getNewOrder` | View do formulário de pedido |
| `postOrder` | INSERT em `TGFITE` (loop) + UPDATE `VLRNOTA` em `TGFCAB`; commit/rollback manual |
| `createOrderHeader` | Chama procedure `JIVA.STP_GERARCABVENDA_IMPORT_YSC` (binds OUT), retorna NUNOTA, UPDATE CODVEND |
| `getMarcas` | `SELECT DISTINCT DESCRICAO FROM TGFMAR` |
| `searchProducts` | Busca com filtro termo/marca em `VW_CONSULTA_SITE_YSC` (ATIVO='S') |
| `searchPartners` | Busca parceiros em `vw_listParceiros_vendas_ysc` |
| `getPaymentMethods` | Formas de pagamento em `vw_listPagamentos_vendas_ysc`, filtro dinâmico por tipo |
| `getPdvLogin` / `postPdvLogin` | Login do PDV + JWT cookie |
| `getMyOrders` | Lista pedidos por papel (ADMIN/GERENTE/vendedor) e status |
| `getOrderDetails` | Detalhe: `TGFCAB` + subqueries `TGFPAR`/`TGFTPV` (MAX DHALTER) + `TGFITE`/`TGFPRO` |

### `faturamentoController.js` (11 exports)
| Função | O que faz |
|---|---|
| `paginaIndex` / `paginaPainel` / `paginaVendedor` | `sendFile` das 3 páginas estáticas .html |
| `apiFiltros` | Empresas com faturamento (`TSIEMP` + subquery `TGFCAB`) |
| `apiDados` | Faturamento por vendedor com **rateio** (`TGFCCM.PERCCOM` normalizado por NUNOTA), devoluções e crédito de cliente (`TGFFIN` títulos 16/69/93) |
| `apiPainel` | `apiDados` do período atual + ano anterior |
| `apiStream` | **SSE** — sentinela `COUNT/SUM/MAX` em `TGFCAB`, eventos `init`/`change`, `:ping` |
| `apiHeatmap` | Células dia-da-semana × hora (`TGFCAB`, DTFATUR/DHALTER) |
| `apiVendedor` | Totais + série diária do vendedor (mesmo rateio) |
| `apiMetas` / `apiMetaSet` | Lê/grava **`data/metas.json`** |

### `acompanhamentoNotasController.js` (6 exports)
| Função | O que faz |
|---|---|
| `paginaIndex` / `paginaIndexLite` | `sendFile` das telas |
| `apiDados` / `apiDadosLite` | Cruzamento `TGFIXN` (Portal) × `TGFCAB` (lançamento) × `TGFFIN` × `AD_NOTA_CHEGADA`; cards e status; lite só fila |
| `apiItens` | Parse do **XML da NF-e** (`TGFIXN.XML`) via `XMLTABLE` com `local-name()` |
| `marcarChegada` | Upsert/delete em `AD_NOTA_CHEGADA` (MERGE); resolve CODUSU em `TSIUSU` |

### `acompanhamentoFinanceiroController.js` (2 exports)
| Função | O que faz |
|---|---|
| `paginaIndex` | `sendFile` da tela |
| `apiDados` | Títulos a pagar (`TGFFIN` RECDESP=-1, TOP5/6, STATUSNOTA='L'), parcela/n parcela, boleto por regex/CODBARRA |

### `requisicoes/requisicoesController.js` (15 exports)
| Função | O que faz |
|---|---|
| `index` | Tela principal (sugere CODEMP destino via `TSIUSU`/`TSIEMP`) |
| `nova` | Formulário (empresas 1/4/5) |
| `separacao` | Fila de separação (roles ESTOQUISTA/ADMIN/GERENTE) |
| `detalhe` | Tela de detalhe (dados via API) |
| `buscarProdutos` | Autocomplete (VW_CONSULTA_SITE_YSC + TGFBAR + VW_MIRROR_EST_YSC; max 50 via ROWNUM) |
| `criarRequisicao` | Cria cabeçalho + itens (sequence `AD_REQ_CAB_SEQ`; STATUS ABERTA; transação) |
| `listarRequisicoes` | Lista com total/itens separados; escopo `fila` exige permissão |
| `obterRequisicao` | Cabeçalho + itens + saldo do grupo |
| `assumirSeparacao` | UPDATE condicional (trava; conflito → 409) |
| `salvarItens` | Marca TEM/PARCIAL/FALTA + QTD_PARCIAL |
| `liberarRequisicao` | Rateia (`ratearItens`), chama `STP_TRANSF_REQUISICAO_YSC` por empresa origem, finaliza |
| `confirmarRecebimento` | STATUS RECEBIDA |
| `cancelarRequisicao` | STATUS CANCELADA (dono/ADMIN, só ABERTA) |
| `excluirRequisicao` | DELETE (cascade) — NUNOTA gerada só ADMIN com forçar |
| `excluirItem` | DELETE de item (nunca o único item) |

### `transferencias/transferenciasController.js` (6 exports)
| Função | O que faz |
|---|---|
| `index` | View da tela |
| `buscarProduto` | Busca produto (`VW_CONSULTA_SITE_YSC`, ROWNUM=1) |
| `buscarEstoque` | Locais origem com saldo (`VW_MIRROR_EST_YSC` ESTOQUE>0) |
| `buscarLocaisDestino` | DISTINCT empresas/locais destino |
| `criarTransferencias` | Lote via procedure `STP_CRIAR_TRANSFERENCIA_YSC` (erro individual não quebra lote) |
| `puxarTransferencias` | Pendentes (`VW_MIRROR_TRANS_YSC`) |

### `transferencias/analiseTransferenciasController.js` (6 exports) — ⚠️ preliminar
Todas consultam tabela `TRANSFERENCIAS` (não-Sankhya) e devolvem `[]` em erro. Funções: `index`, `buscarTransferenciasPendentes`, `buscarTransferenciasFinalizadas`, `buscarAnalisePorPeriodo`, `buscarAnalisePorProduto`, `buscarAnalisePorLocal`.

### `pedidos/pedidoComprasController.js` (24 exports)
Camadas: (a) views EJS (6), (b) CRUD em tabelas custom `CABECALHO_PEDIDO_YSC`/`PEDIDO_PROCESSADO_YSC`, (c) leitura/escrita em tabelas Sankhya (`TGFITE`, `TGFCAB`, `TGFPAR`, `TGFMAR`, `TGFTPV`), (d) integração com a procedure **`JIVA.STP_GERARPEDCOMPRA_IMPORT_YSC`** (com retry por ORA-01422 usando SAVEPOINT + backoff exponencial).
Destaques: `criarPedido` (bug `emp`), `finalizarPedidoComValores` (fluxo completo de preços editados), `reprocessarPedido` (duplica pedido via USER_TAB_COLUMNS), `getPainelDados` (classificação PRAZO/ATRASADO/CRITICO).

### `orcamentoOCRController.js` (7 exports)
| Função | O que faz |
|---|---|
| `index` / `listarModelos` | View + lista de modelos (`AD_OCR_MODELOS`) |
| `uploadModelo` | Upload de template .xlsx (valida com ExcelJS; remove arquivo inválido) |
| `processarImagem` | Executa `python/ocr_processor.py` via `spawn` (timeout 10min), preenche Excel com ExcelJS (insere linhas, copia estilo/fórmulas SUM) |
| `downloadArquivo` | Serve o .xlsx gerado (sanitiza nome) |
| `deletarModelo` | Soft delete + remove arquivo |
| `listarHistorico` | Últimos 50 (`AD_OCR_HISTORICO` join `AD_OCR_MODELOS`) |

### Controllers pequenos
| Controller | Funções | Resumo |
|---|---|---|
| `authController.js` | `postLogin`, `postLogout`, `ensureAuth` | Login (TSIUSU + TDDOPC roleName), logout, middleware (⚠️ redundante com authMiddleware) |
| `produtoController.js` | `getProdutoByCodigo`, `postContagem` | Produto por barras (`VW_PRODUTOS_BLC`); contagem (`AD_CONTAGENS`) |
| `contagemController.js` | `createContagem`, `listContagens`, `getContagensByUsuario`, `deleteContagensByUsuario`, `updateQuantidade` | CRUD de contagens (`AD_CONTAGENS` + `VW_PRODUTOS_BLC`) |
| `exportacaoController.js` | `exportarContagens` | Exporta Excel (ExcelJS) |
| `controleCartaoController.js` | `index`, `create`, `store`, `listPending` | Solicitações de cartão (`AD_SOLICITACAO` + `AD_CARTOES`) |
| `calculadoraCustoController.js` | `index` | View da calculadora |
| `coletorController.js` | `coletor` | Renderiza `pages/coletor` ⚠️ **view não existe** (função não usada) |
| `consultaProdutosController.js` | `index`, `getMarcas`, `searchProducts`, `getStock` | Consulta de produtos/marcas/estoque |
| `consultaController.js` | `consultaProduto`, `consultaGertec`, `consultaEanPhp` | Consultas de preço/custo (TGFPRO + funções Sankhya) |
| `homeController.js` | `home` | Renderiza `pages/home` ⚠️ **view não existe** (rota quebrada) |
| `usuarioController.js` | — | **Arquivo vazio** |

---

## 8. Views

### Templates / compartilhados
- `views/layouts/main.ejs` — layout principal (PDV, home, coletor)
- `views/partials/header.ejs`, `sidebar.ejs`, `sidebar_extra.ejs` — header e sidebars
- `views/menu.ejs` — Central de Acessos (dashboard de módulos com busca + favoritos)
- `views/login.ejs` — tela de login

### Por módulo
| Pasta | Arquivos |
|---|---|
| `pdv/` | `login.ejs`, `manager_dashboard.ejs`, `sales_dashboard.ejs`, `new_order.ejs`, `my_orders.ejs`, `partials/header.ejs`, `partials/footer.ejs` |
| `pedidos/` | `pedidoCompras.ejs`, `listaPedidos.ejs`, `fazerPedidos.ejs`, `finalizarPedidos.ejs`, `pedidoFinalizados.ejs`, `painelPedidos.ejs` |
| `requisicoes/` | `index.ejs`, `nova.ejs`, `separacao.ejs`, `detalhe.ejs`, `sem-acesso.ejs` |
| `transferencias/` | `index.ejs` |
| `analise-transferencias/` | `index.ejs` |
| `orcamento-ocr/` | `index.ejs` |
| `consultaProdutos/` | `index.ejs`, `layout.ejs` |
| `calculadoraCusto/` | `index.ejs`, `layout.ejs` |
| `controleCartao/` | `novo.ejs`, `pendentes.ejs`, `layout.ejs` |
| `faturamento/` | `index.html`, `painel.html`, `vendedor.html` (estáticos, `sendFile`) |
| `acompanhamentoNotas/` | `index.html`, `indexLite.html` (estáticos) |
| `acompanhamentoFinanceiro/` | `index.html` (estático) |
| `pages/` | **vazia** ⚠️ |
| `ControlCompras/` | `home.ejs`, `step1_compras.ejs` … `step5_compras.ejs`, `CompilerPySIEG.py` — **embrião abandonado, sem rotas** |
| raiz (órfãs) | `coletor.ejs`, `coletorDev.ejs`, `consultaPendenciaFornecedor.ejs`, `pendenciaFornecedores.ejs`, `historicoPendenciaFornecedor.ejs`, `importador.ejs`, `menu.backup-20260731.ejs` |

> As telas de faturamento/acompanhamento são HTML estáticos (bundle próprio) servidos por `sendFile`, e consomem as APIs do próprio módulo.

---

## 9. Python — OCR de Orçamento

`python/ocr_processor.py` é um script **standalone** executado via `spawn`:
- Recebe o caminho da imagem como argumento → retorna **JSON no stdout** (`[{descricao, quantidade}, ...]`).
- Usa **PaddleOCR** (`lang='pt'`, CPU) com fallback de API para versões antigas/nova do pacote.
- Aplica **padding branco** na imagem (PIL) e **detecta linhas horizontais de grade** (OpenCV + morfologia) para agrupar o texto em linhas da planilha.
- Separa descrição × quantidade pela coordenada X (limiar dinâmico = 75% da largura) e parseia múltiplos formatos ("ARROZ 5KG 10", "10x PRODUTO", "QTD: 10", etc.) por regex.
- Requer `python/requirements.txt` (paddlepaddle, paddleocr, Pillow) — **não instalados no Dockerfile**.

---

## 10. Docker

- **Dockerfile**: `node:18-bullseye-slim` + Oracle Instant Client 19.19 (baixado da Oracle), `python3`, toolchain nativo (make/g++) para `sqlite3`/`bcrypt`. `CMD node app.js`, porta 3000.
- **docker-compose.yml**: serviço único `app` (`projeto-docker`), `restart: always`, `ports 3000:3000`, `env_file: .env`, volume `./data:/usr/src/app/data` (persiste `metas.json`), `apparmor=unconfined`.
- ⚠️ Conforme `RESUMO.md`, **o container ainda não subiu em produção** e o Dockerfile **não instala** `python/requirements.txt` (OCR quebraria dentro do container).

---

## 11. Tabelas / views do banco (Sankhya/Oracle)

### Padrão Sankhya
| Objeto | Uso |
|---|---|
| `TSIUSU` | Usuários + login (`AD_SENHA`, `AD_ROLE`) |
| `TDDOPC` | Nome legível da role (NUCAMPO 9999990154) |
| `TSIEMP` | Empresas (razão social / nome fantasia) |
| `TGFPRO` | Produtos (descrição, referência, custo) + funções `SNK_PRECO`, `YSC_PUXACUSTO_EXC`, `YSC_PUXACUSTO_S_IPI_EXC` |
| `TGFBAR` | Códigos de barras |
| `TGFMAR` | Marcas |
| `TGFPAR` | Parceiros (fornecedores/clientes, CNPJ) |
| `TGFCAB` | Cabeçalho de notas/pedidos |
| `TGFITE` | Itens de nota |
| `TGFFIN` | Financeiro/títulos |
| `TGFTPV` / `TGFTOP` | Formas de pagamento / tipos de operação |
| `TGFVEN` | Vendedores (APELIDO) |
| `TGFCCM` | Comissões (rateio de vendas) |
| `TGFIXN` | Notas importadas no Portal (campo XML da NF-e) |
| `TGFTIT` | Tipos de título |
| `TGFEST` | Estoque (base das views de espelho) |
| `TGFNUM` | Numeração (⚠️ nunca deletar; NUNOTA via `STP_KEYGEN_TGFNUM`) |

### Views customizadas
| View | Uso |
|---|---|
| `VW_PRODUTOS_BLC` | Produtos p/ coletor/contagem |
| `VW_CONSULTA_SITE_YSC` | Produtos com preço/custo/estoque p/ consulta e PDV |
| `VW_MIRROR_EST_YSC` | Espelho de estoque por empresa/local |
| `VW_MIRROR_TRANS_YSC` | Transferências pendentes |
| `VW_LISTFUNCIONARIOS_VENDAS_YSC` | Vendedores/gerentes p/ login PDV e dashboards |
| `vw_listPedidos_vendas_ysc` | Pedidos de venda p/ dashboards |
| `vw_listParceiros_vendas_ysc` | Parceiros p/ PDV |
| `vw_listPagamentos_vendas_ysc` | Formas de pagamento p/ PDV |

### Tabelas customizadas (JIVA. / AD_. / YSC.)
| Objeto | Uso |
|---|---|
| `AD_CONTAGENS` | Contagens de estoque |
| `AD_SOLICITACAO` / `AD_CARTOES` | Controle de cartões |
| `AD_OCR_MODELOS` / `AD_OCR_HISTORICO` | Modelos e histórico do OCR |
| `AD_NOTA_CHEGADA` | Carimbo manual de chegada de nota |
| `JIVA.AD_REQ_CAB_YSC` / `JIVA.AD_REQ_ITE_YSC` + seq `AD_REQ_CAB_SEQ` | Requisições entre lojas |
| `CABECALHO_PEDIDO_YSC` / `PEDIDO_PROCESSADO_YSC` | Pedidos de compra (camada custom) |
| `TRANSFERENCIAS` | ⚠️ análise de transferências — **não é tabela real do Sankhya** |

### Procedures PL/SQL (integração)
| Procedure | Uso |
|---|---|
| `JIVA.STP_TRANSF_REQUISICAO_YSC` | Gera nota de transferência a partir de requisição (uma por empresa de origem) |
| `JIVA.STP_CRIAR_TRANSFERENCIA_YSC` | Cria transferência direta |
| `JIVA.STP_GERARPEDCOMPRA_IMPORT_YSC` | Gera pedido de compra no Sankhya |
| `JIVA.STP_GERARCABVENDA_IMPORT_YSC` | Gera cabeçalho de venda (PDV) |
| `SNK_PRECO`, `YSC_PUXACUSTO_EXC`, `YSC_PUXACUSTO_S_IPI_EXC` | Funções de preço/custo |

---

## 12. Pontos de atenção / bugs conhecidos

1. **`app.js` monta `coletorRoutes` 2×** e **`pdvRoutes` declara `GET /partners` 2×** — duplicações inofensivas mas sujas.
2. **`homeController.home` e `coletorController.coletor`** renderizam `pages/home` / `pages/coletor`, e a pasta `views/pages/` está **vazia** → essas rotas quebrariam se chamadas (`/home`).
3. **`pdvController.postOrder`**: INSERT com **vírgula sobrando** antes de `)` (`CODLOCALORIG, )`) — quebraria a query.
4. **`pedidoComprasController.criarPedido`**: variável `emp` **sem declaração** (global implícita); se `gpEmp` não for 1/2/3 insere NULLs.
5. **`pdvController.getOrderDetails`**: chave `nunota` duplicada no JSON retornado.
6. **`transferenciasController.buscarProduto`**: parâmetro se chama `codigoBarras` mas a query **não consulta `TGFBAR`** (nome enganoso).
7. **Análise de Transferências**: aponta para tabela `TRANSFERENCIAS` não-Sankhya, `ROWNUM=1` em joins (não determinístico), engole erros devolvendo `[]`, TODOs pendentes.
8. **Senha em texto puro**: `TSIUSU.AD_SENHA` é campo custom do Sankhya, comparado como string (limitação aceita). `authMiddleware` **loga a senha** no console — remover.
9. **URL de produção hardcoded** (`appexclusiva.innube.com.br`) em `app.js`.
10. **Docker**: nunca subiu no servidor; `requirements.txt` do Python não instalado no Dockerfile.
11. **Arquivos lixo na raiz**: `index.html`, `style.css`, `css/`, `pdv/` (só node_modules) — podem ser removidos.
12. **`authController.ensureAuth`** duplica o `authMiddleware.ensureAuth` (não usado).
13. **`usuarioController.js`** está vazio.
14. Views órfãs sem rotas: `pendenciaFornecedores.ejs`, `consultaPendenciaFornecedor.ejs`, `historicoPendenciaFornecedor.ejs`, `importador.ejs`, `ControlCompras/*`.
15. Sem testes automatizados e sem lint configurado.
