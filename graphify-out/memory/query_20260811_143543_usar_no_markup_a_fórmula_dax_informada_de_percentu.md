---
type: "query"
date: "2026-08-11T14:35:43.930002+00:00"
question: "Usar no Markup a fórmula DAX informada de percentual de desconto"
contributor: "graphify"
outcome: "corrected"
correction: "O usuário deseja chamar e exibir como Markup a fórmula de percentual de desconto do Power BI."
source_nodes: ["markupController.js"]
---

# Q: Usar no Markup a fórmula DAX informada de percentual de desconto

## Answer

Cálculo do campo markupPct alterado para (VLRTOT - VLRLIQUIDO) / VLRTOT vezes 100, exatamente como a fórmula informada. Teste com bruto 1000 e líquido 800 retornou 20%.

## Outcome

- Signal: corrected
- Correction: O usuário deseja chamar e exibir como Markup a fórmula de percentual de desconto do Power BI.

## Source Nodes

- markupController.js