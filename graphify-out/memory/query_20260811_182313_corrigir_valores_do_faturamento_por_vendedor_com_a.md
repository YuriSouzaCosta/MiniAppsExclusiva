---
type: "query"
date: "2026-08-11T18:23:13.002449+00:00"
question: "Corrigir valores do Faturamento por Vendedor com as exclusões comerciais do Markup"
contributor: "graphify"
outcome: "useful"
source_nodes: ["faturamentoController.js", "index.html"]
---

# Q: Corrigir valores do Faturamento por Vendedor com as exclusões comerciais do Markup

## Answer

Todas as consultas do faturamento por vendedor passaram a aceitar somente TIPMOV V e a excluir tipos de negociação contendo BONIF, VALE+FUNCION ou DEVOLU, usando a versão mais recente da TGFTPV sem join com fan-out. A regra alcança ranking, painel, comparativo anual, série diária, heatmap, filtros e SSE.

## Outcome

- Signal: useful

## Source Nodes

- faturamentoController.js
- index.html