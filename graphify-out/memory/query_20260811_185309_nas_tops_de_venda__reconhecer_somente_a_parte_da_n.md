---
type: "query"
date: "2026-08-11T18:53:09.912276+00:00"
question: "Nas TOPs de venda, reconhecer somente a parte da nota além do crédito de cliente"
contributor: "graphify"
outcome: "useful"
source_nodes: ["faturamentoController.js"]
---

# Q: Nas TOPs de venda, reconhecer somente a parte da nota além do crédito de cliente

## Answer

Para TOPs 3105, 3106 e 3199, o faturamento passou a ser GREATEST(VLRNOTA menos títulos financeiros de crédito do cliente, zero). Crédito integral gera zero; crédito parcial reconhece apenas a diferença; sem crédito reconhece a nota. TOPs 3202, 3200, 3204 e 3201 continuam abatendo como devolução. Regra aplicada ao ranking, série, heatmap e sentinela.

## Outcome

- Signal: useful

## Source Nodes

- faturamentoController.js