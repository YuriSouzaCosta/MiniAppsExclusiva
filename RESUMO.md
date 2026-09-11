# RESUMO DO PROJETO — "PROJETO DOCKER"

> Portal web interno da **Exclusiva Utilidades**, integrado ao ERP **Sankhya (Oracle Database)**.
> Aplicação Node.js/Express com views EJS, containerizada com Docker, reunindo vários módulos operacionais (PDV, Pedidos de Compra, Transferências, OCR de orçamentos, etc.).

---

## 1. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 18 + Express 4 |
| Views | EJS (server-side rendering) + Bootstrap |
| Banco de dados | **Oracle** (base do ERP Sankhya) via `oracledb` 5.3 + Oracle Instant Client 19.19 |
| Autenticação | JWT em cookie (`auth_token`), validado contra a tabela `TSIUSU` do Sankhya (campos custom `AD_SENHA`, `AD_ROLE`) |
| OCR | Python 3 + **PaddleOCR** + OpenCV (script `python/ocr_processor.py` chamado via `spawn`) |
| Planilhas | ExcelJS / xlsx |
| Container | Docker (`node:18-bullseye-slim`) + docker-compose, porta **3000** |
| Produção | `https://appexclusiva.innube.com.br` (URL fixada quando `NODE_ENV != development`) |

---

## 2. Arquitetura

Padrão **MVC simples**:

```
app.js                  → bootstrap: middlewares, rotas, conexão Oracle (pool), listen :3000
routes/                 → definição de rotas por módulo
controllers/            → lógica de negócio + queries SQL diretas no Oracle
views/                  → páginas EJS por módulo
public/                 → CSS/JS estáticos por módulo
middleware/authMiddleware.js → login (TSIUSU) + geração/validação de JWT
config/db/oracle.js     → pool oracledb (poolMax 4), helper simpleExecute
python/                 → processador OCR standalone (stdout JSON)
uploads/                → imagens, modelos Excel e planilhas processadas (OCR)
```

Fluxo de autenticação: `POST /login` → busca usuário em `TSIUSU` → gera JWT com role (`ADMIN`, etc.) → cookie → middleware global protege todas as rotas exceto públicas (`/login`, `/coletor`, `/gertec`, `/consulta-ean`, estáticos).

---

## 3. Módulos da Aplicação

| Módulo | Rota base | O que faz |
|---|---|---|
| **Menu / Home** | `/` | Dashboard central de acesso aos módulos |
| **PDV (Ponto de Venda)** | `/pdv` | Módulo em desenvolvimento ativo (branch `PDV-EXC`): login próprio, dashboard de **gerente** (métricas de vendas, top vendedores, gráfico, filtro por empresa/período via `TGFCAB`), dashboard de **vendedor**, criação de pedido (`/pdv/pos`), meus pedidos, busca de produtos/parceiros/formas de pagamento |
| **Pedidos de Compra** | `/` (pedidoCompras) | Criação de pedidos com seleção dinâmica de marca, fornecedor e forma de pagamento; telas fazer/finalizar/painel/finalizados |
| **Transferências** | `/transferencias` e `/analise-transferencias` | Transferência de produtos entre lojas/empresas e análise |
| **Orçamento OCR** | `/orcamento-ocr` | Upload de foto de orçamento → PaddleOCR extrai descrição+quantidade → preenche template Excel cadastrado (tabela custom `AD_OCR_MODELOS`) |
| **Coletor** | `/coletor` | Coleta de dados de produtos (rota pública, provavelmente para dispositivo coletor/Gertec) |
| **Consulta Gertec / EAN** | `/gertec/:codbarra`, `/consulta-ean` | Consulta de preço/produto por código de barras (terminal Gertec) |
| **Contagem** | `/contagem` | Contagem de estoque |
| **Exportação** | `/exportacao` | Exportação de dados (Excel) |
| **Controle de Cartão** | `/controle-cartao` | Controle de cartões |
| **Calculadora de Custo** | `/calculadora-custo` | Cálculo de custos |
| **Consulta de Produtos** | `/consulta-produtos` | Consulta de produtos |
| **ControlCompras (views)** | — | Fluxo em steps (step1–step5) de compras + script `CompilerPySIEG.py` (integração SIEG?) |
| **Pendência Fornecedores** | — | Consulta e histórico de pendências |

---

## 4. Banco de Dados (Sankhya)

Documentado em [analise_banco_dados.md](analise_banco_dados.md). Tabelas núcleo usadas:

- **TGFCAB** — cabeçalho de notas/pedidos (usada nos dashboards do PDV)
- **TGFITE** — itens das notas
- **TGFPRO** — produtos
- **TGFFIN** — financeiro
- **TGFTOP / TGFTIT** — tipos de operação e título
- **TGFEST** — estoque
- **TGFVEN** — vendedores
- **TSIUSU** — usuários (autenticação, com campos custom `AD_SENHA` e `AD_ROLE`)
- **AD_OCR_MODELOS** — tabela customizada para os templates do módulo OCR

Credenciais via `.env` (`ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECTSTRING`, `JWT_SECRET`).

---

## 5. Docker

- **Dockerfile**: `node:18-bullseye-slim` + Oracle Instant Client 19.19 + python3 + toolchain de build (sqlite3/bcrypt nativos). `CMD node app.js`.
- **docker-compose.yml**: serviço único `app` (`projeto-docker`), porta 3000, `restart: always`, `.env` via `env_file`.
- ⚠️ **O Docker ainda não rodou no servidor** — a containerização existe mas nunca subiu em produção.
- ⚠️ O Dockerfile instala `python3` mas **não instala** as dependências do `python/requirements.txt` (PaddleOCR/OpenCV) — precisa adicionar `pip install -r python/requirements.txt` antes do OCR funcionar no container.

---

## 6. Estado Atual (branch `PDV-EXC`)

Trabalho em andamento, ainda não commitado:

- **Modificados**: núcleo do PDV (`pdvController`, `pos.js`, dashboards, `new_order.ejs`), Pedidos de Compra, `authMiddleware`, `menu.ejs`, sidebar, estilos.
- **Novos (untracked)**: módulo **Orçamento OCR** completo (controller, rota, view, `python/`, `uploads/`), `consultaController.js` (Gertec/EAN), `pdv-mobile.css`, `my_orders.ejs`, `painelPedidos.ejs`, `analise_banco_dados.md`.

---

## 7. Pontos de Atenção / Dívidas Técnicas

1. **Senhas em texto puro (limitação aceita)**: `AD_SENHA` é um **campo adicional (custom) do Sankhya** — a senha vem como string direto do banco e não há como aplicar hash, pois o campo é gerenciado pelo ERP. Mesmo assim, os logs imprimem a senha no console (`authenticate(): encontrado registro: { ..., senhaBanco }`) — **remover esse log**.
2. **Docker nunca subiu no servidor** — deploy do container ainda pendente.
3. **OCR no Docker**: requirements Python (PaddleOCR/OpenCV) não instalados na imagem — ajustar Dockerfile antes do deploy.
4. **Arquivos confirmados como lixo** (podem ser removidos): `index.html`, `style.css`, `css/` e pasta `pdv/` (só contém `node_modules`) na raiz.
5. **Rota duplicada**: `router.get('/partners', ...)` declarada 2× em `routes/pdvRoutes.js`; `coletorRoutes` montado 2× em `app.js`.
6. **Dependências desnecessárias**: `fs`, `path`, `upload`, `projeto: file:` no package.json não deveriam estar lá.
7. **URL de produção hardcoded** em `app.js` (`appexclusiva.innube.com.br`).
8. Sem testes automatizados e sem lint configurado.

---

## 8. Decisões Confirmadas

| Tema | Decisão |
|---|---|
| Arquivos órfãos na raiz (`pdv/`, `index.html`, `style.css`, `css/`) | **Lixo** — podem ser removidos |
| Deploy Docker | **Nunca rodou no servidor**; containerização ainda não está em produção |
| `CompilerPySIEG.py` / ControlCompras | Era o embrião de uma **central que acompanharia todo o processo da nota: do faturamento até a entrada** (fluxo completo NF-e). Projeto não concluído |
| Senhas (`TSIUSU.AD_SENHA`) | Texto puro, **sem possibilidade de hash** — campo adicional do Sankhya, comparação direta como string |
| Estratégia de branches | **PDV** → commit na `PDV-EXC` e merge na `main`; **módulo OCR** (controller, rota, view, `python/`, `uploads/`) → deve ir para uma **branch separada** |
