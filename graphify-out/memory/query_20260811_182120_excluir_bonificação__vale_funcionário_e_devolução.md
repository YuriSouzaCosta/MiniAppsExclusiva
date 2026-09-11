---
type: "query"
date: "2026-08-11T18:21:20.179245+00:00"
question: "Excluir bonificação, vale funcionário e devolução do relatório de Markup"
contributor: "graphify"
outcome: "useful"
source_nodes: ["markupController.js"]
---

# Q: Excluir bonificação, vale funcionário e devolução do relatório de Markup

## Answer

O Markup passou a considerar somente TIPMOV V e exclui tipos de negociação cuja descrição mais recente na TGFTPV contenha BONIF, VALE+FUNCION ou DEVOLU. A regra também vale para a última venda usada na estimativa de custo.

## Outcome

- Signal: useful

## Source Nodes

- markupController.js