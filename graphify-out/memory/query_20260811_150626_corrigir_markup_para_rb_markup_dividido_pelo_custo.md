---
type: "query"
date: "2026-08-11T15:06:26.844408+00:00"
question: "Corrigir Markup para RB Markup dividido pelo custo total"
contributor: "graphify"
outcome: "corrected"
correction: "Markup não é percentual de desconto; é (VLRLIQUIDO - CUSTO_TOTAL) / CUSTO_TOTAL."
source_nodes: ["markupController.js"]
---

# Q: Corrigir Markup para RB Markup dividido pelo custo total

## Answer

Cálculo definitivo aplicado: RB Markup = venda líquida menos custo total; Markup percentual = RB Markup dividido pelo custo total vezes 100. Teste com líquido 800 e custo 400 retornou RB 400 e Markup 100%.

## Outcome

- Signal: corrected
- Correction: Markup não é percentual de desconto; é (VLRLIQUIDO - CUSTO_TOTAL) / CUSTO_TOTAL.

## Source Nodes

- markupController.js