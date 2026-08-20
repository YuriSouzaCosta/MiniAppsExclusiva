---
type: "query"
date: "2026-08-11T18:31:57.590636+00:00"
question: "Separar TOPs de venda e devolução no Faturamento por Vendedor"
contributor: "graphify"
outcome: "useful"
source_nodes: ["faturamentoController.js", "index.html"]
---

# Q: Separar TOPs de venda e devolução no Faturamento por Vendedor

## Answer

Vendas agora usam exclusivamente TOPs 3105, 3106 e 3199 com TIPMOV V. Devoluções abatidas usam TOPs 3202, 3200, 3204 e 3201 com TIPMOV D. Bonificação e Vale Funcionário seguem excluídos, mas devolução não é mais bloqueada pela descrição do tipo de negociação. Regra aplicada ao ranking, totais, séries, comparativos, sentinela e filtros; heatmap usa somente vendas.

## Outcome

- Signal: useful

## Source Nodes

- faturamentoController.js
- index.html