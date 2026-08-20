---
type: "query"
date: "2026-08-11T15:06:59.671628+00:00"
question: "O relatório de Markup está considerando devoluções?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["markupController.js"]
---

# Q: O relatório de Markup está considerando devoluções?

## Answer

Sim. A consulta inclui TIPMOV V e D. TIPMOV D recebe SINAL -1, abatendo venda bruta, venda líquida, desconto e custo antes do cálculo de RB Markup e Markup percentual. Somente notas confirmadas STATUSNOTA L e TOPs fiscais configuradas entram.

## Outcome

- Signal: useful

## Source Nodes

- markupController.js