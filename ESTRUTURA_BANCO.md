# Estrutura do Banco de Dados — ERP Sankhya (Oracle)

> Documento de referência para trabalhar com o banco em **qualquer máquina**.
> Passe este arquivo junto com o projeto para outra máquina com Claude: ele
> resume o banco, as convenções e as **armadilhas** que já custaram retrabalho.

---

## 1. O que é

Camada de **consultas, análises e relatórios** sobre o banco **Oracle do ERP
Sankhya** de uma empresa de **varejo multicanal** (loja física + marketplaces).
São **7 empresas** no grupo (CODEMP 1 a 7), CNPJs distintos, todas tratadas como
sediadas em **Goiás**.

| CODEMP | Nome | | CODEMP | Nome |
|:--:|---|---|:--:|---|
| 1 | EXCLUSIVA UTILIDADES | | 5 | SITE EXCLUSIVA |
| 2 | SG UTILIDADES | | 6 | EXCLUSIVA DECORA |
| 3 | EXCLUSIVA UTIL | | 7 | ASG DISTRIBUICAO |
| 4 | EXCLUSIVA PRIME 85 | | | |

---

## 2. Conexão

Configuração toda por variáveis de ambiente (arquivo `.env`). **Nunca** deixar
senha escrita em código.

```
DB_HOST=exclusiva.duckdns.org
DB_PORT=18012
DB_SERVICE_NAME=orcl
DB_USER=<usuario>
DB_PASSWORD=<senha>
ORACLE_CLIENT_LIB=<pasta do Oracle Instant Client>
```

**Modo Thick obrigatório:** o banco usa verificadores de senha antigos. É preciso
o **Oracle Instant Client** e `oracledb.init_oracle_client(lib_dir=...)`. Sem
ele, a conexão falha com `ORA-28040` / `DPY-3015`.

**Instalação numa máquina nova:** rode `INSTALAR.bat` (duplo-clique, instala até
o Python) ou `python setup_banco.py` (baixa o Instant Client e testa sozinho).

> ⚠️ A build **free-threaded** do Python (`python3.13t.exe`, `Py_GIL_DISABLED`)
> **quebra o `oracledb`**. Use uma build normal do CPython.

---

## 3. Como consultar

Script principal: **`scripts/query_helper.py`** — recebe SQL como argumento,
mostra prévia no console e exporta CSV (delimitador `;`, encoding `utf-8-sig`
para abrir direto no Excel PT-BR, saída em `relatorios/`).

```bash
python scripts/query_helper.py "SELECT CODEMP, NOMEFANTASIA FROM TSIEMP"
python scripts/query_helper.py "SELECT ... " --export produtos.csv
```

---

## 4. Tabelas principais

Prefixo `TGF` = Gestão Comercial/Financeira; `TSI` = Sistema; campos customizados
levam o prefixo `AD_`.

| Tabela | Descrição | PK | Campos |
|---|---|---|:--:|
| **TGFCAB** | Cabeçalho de Notas/Pedidos (tabela central) | `NUNOTA` | ~420 |
| **TGFITE** | Itens das notas/pedidos | `NUNOTA+SEQUENCIA` | ~235 |
| **TGFPRO** | Cadastro de produtos | `CODPROD` | ~399 |
| **TGFFIN** | Movimentação financeira (títulos a pagar/receber) | `NUFIN` | ~297 |
| **TGFNAT** | Naturezas (plano de contas gerencial) | `CODNAT` | — |
| **TGFTOP** | Tipo de Operação (motor de regras fiscais) | `CODTIPOPER` | ~367 |
| **TGFTIT** | Tipo de Título (formas de pagamento) | `CODTIPTIT` | ~72 |
| **TGFTPV** | Tipo de Negociação/Venda | `CODTIPVENDA` | ~58 |
| **TGFEST** | Posição de estoque | `CODEMP+CODLOCAL+CODPROD+CONTROLE` | ~20 |
| **TGFVEN** | Cadastro de vendedores | `CODVEND` | ~40 |
| **TGFCUS** | Custos do produto (por data) | `CODPROD+DTATUAL+...` | — |
| **TGFPAR** | Parceiros (clientes/fornecedores) | `CODPARC` | — |
| **TSIEMP** | Empresas do grupo | `CODEMP` | — |
| **TSICID / TSIUFS** | Cidades / UFs | `CODCID` / `CODUF` | — |

Especificações detalhadas por tabela (colunas e tipos) em **`docs/schema/*.md`**
e nos dumps **`schema/*.json`**. Dicionário navegável em **`docs/README.md`**.

---

## 5. Relacionamentos-chave

```
TGFCAB ─1:N─ TGFITE      (via NUNOTA)
TGFCAB ─1:N─ TGFFIN      (via NUNOTA)
TGFCAB ─N:1─ TGFTOP      (via CODTIPOPER + DHTIPOPER=DHALTER)   ← ver armadilha
TGFCAB ─N:1─ TGFTPV      (via CODTIPVENDA + DHTIPVENDA=DHALTER)
TGFCAB ─N:1─ TGFVEN      (via CODVEND)
TGFCAB ─N:1─ TGFPAR      (via CODPARC)
TGFITE ─N:1─ TGFPRO      (via CODPROD)
TGFFIN ─N:1─ TGFNAT      (via CODNAT)
TGFFIN ─N:1─ TGFTIT      (via CODTIPTIT)
TGFEST ─N:1─ TGFPRO      (via CODPROD)
TGFPAR → TSICID → TSIUFS (UF do parceiro: TSICID.UF é numérico = CODUF; a sigla
                          está em TSIUFS)
```

---

## 6. Campos importantes de TGFCAB e TGFFIN

**TGFCAB (notas):**
- `TIPMOV` — tipo de movimento: `V`=Venda, `D`=Devolução, `C`=Compra, `P`=Pedido, `O`=Outro, `T`=Transferência.
- `STATUSNOTA` — `'L'` = nota confirmada/liberada (filtrar sempre por isso em faturamento).
- `CODTIPOPER` — TOP (tipo de operação). TOPs de venda usados: **3106, 3199** (e no relatório de vendas também 3101, 3104, 3105, 3200, 3202, 3204). TOP **206 = ajuste de estoque (NÃO é venda)**.
- `VLRNOTA`, `VLRICMS`, `DTNEG` (data de negociação).

**TGFFIN (financeiro):**
- `CODNAT` — natureza (liga a TGFNAT; é o "plano de contas" gerencial).
- `RECDESP` — sinal: **`-1` = Despesa**, **`+1` = Receita**, `0` = indefinido.
- `VLRDESDOB` — valor do desdobramento (é o valor que se soma no gerencial).
- Datas: **`DTNEG`** (negociação), **`DTVENC`** (vencimento), **`DHBAIXA`** (pagamento/baixa). A data certa depende do relatório — ver armadilha nº 4.
- `CODTIPOPER` — em TGFFIN, `1` = FINANCEIRO e `100` = DESPESA são as operações de despesa "normais" (há também 5, 6, 99 etc. para outras operações).

---

## 7. Armadilhas (aprendidas na prática — leia antes de escrever queries)

1. **Nunca `SELECT *` em TGFCAB** (~420 campos) nem TGFITE (~235). Projete só o que precisa.

2. **VLRICMS existe em TGFCAB (total) E em TGFITE (por item).** Cuidado com JOIN para não somar o ICMS duas vezes.

3. **TGFTOP tem várias linhas por CODTIPOPER** (uma versão por `DHALTER`). Fazer `JOIN` só com `CODTIPOPER` causa *fan-out* (multiplica valores). Ou filtre `CODTIPOPER` direto em TGFCAB, ou faça o JOIN casando **`CAB.DHTIPOPER = TOP.DHALTER`**.

4. **Data de competência ≠ data de negociação.** Para despesas do financeiro, a
   competência do mês costuma ser pela **`DTVENC` (vencimento)**, não `DTNEG`.
   `DTNEG` produz números *quase* certos e erra silenciosamente em despesas
   recorrentes (energia, telefone) lançadas num mês e vencendo em outro. Já para
   **receita/faturamento (TGFCAB)**, usa-se **`DTNEG`** (a venda pertence ao mês
   negociado). Regra de ouro: em dúvida, compare a mesma soma por `DTNEG`,
   `DTVENC` e `DHBAIXA`.

5. **Somar despesa: filtrar `RECDESP = -1`.** Estornos/créditos (`RECDESP = +1`)
   normalmente **não** são abatidos, dependendo da regra do relatório.

6. **Acentuação:** textos vêm em latin-1 gravado como utf-8. Corrija com
   `valor.encode('latin-1').decode('utf-8')` ao exibir.

7. **Taxas de cartão em TGFTIT podem estar desatualizadas** vs. contratos vigentes.

---

## 8. Naturezas (CODNAT) e a função de custo

- **TGFNAT** guarda a descrição de cada natureza (`DESCRNAT`). Os códigos são de
  7 dígitos e agrupados por prefixo, ex.: `3010xxx` = Pessoal (folha), `303xxxx`
  = Utilidades/serviços, `5xxxxxx` = Impostos, `2xxxxxx` = Compras/estoque.
  Sempre confira `DESCRNAT` no banco antes de assumir o que uma natureza é.

- **`SNK_GET_PRECO(NUTAB, CODPROD, DATA)`** — função nativa do Sankhya que
  devolve o preço de tabela de um produto numa data. Usada no cálculo de
  receita/custo de vendas.

- **TGFCUS** — custos do produto por data (`ENTRADACOMICMS`, etc.); pega-se o
  registro mais recente via `MAX(DTATUAL)`. Base do CMV (custo da mercadoria
  vendida).

---

## 9. Negócio (contexto para análises)

- Multicanal: loja física + 5 marketplaces (ML 16%, Amazon 16%, B2W 16%, Olist 20%, Luiza 12%).
- 3 adquirentes de cartão (Cielo, Getnet, Cielo SG).
- Comissão: 5% à vista/1X, 3% a prazo; cai para 3% quando há desconto (campo `AD_COMISSAO`).
- ICMS GO interno **19%** (desde 01/04/2024); interestadual 7% (Sul/Sudeste→GO) e 12% (demais).
- Cobertura fiscal inclui IBS/CBS (Reforma Tributária).

---

## 10. O que já existe no projeto (para reaproveitar)

- **`scripts/query_helper.py`** — roda qualquer SQL e exporta CSV.
- **`scripts/gerar_dre.py`** — gera a DRE mensal (ver regras em
  `~/.claude/skills/dre-mensal-sankhya/references/regras-dre.md`).
- **`scripts/tax_*.py`** — estudo de regimes tributários (Simples × Presumido ×
  Real) das 7 empresas.
- Dumps de schema em `schema/`, dicionário em `docs/`.

> Convenção do projeto: código em `scripts/`, entregáveis em `relatorios/`, JSONs
> de trabalho em `dados/`, schema em `schema/`, docs em `docs/`. Caminhos
> resolvidos por `scripts/_paths.py`.
