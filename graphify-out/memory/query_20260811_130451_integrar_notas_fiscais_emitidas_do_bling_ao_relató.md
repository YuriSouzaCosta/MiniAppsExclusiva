---
type: "query"
date: "2026-08-11T13:04:51.453194+00:00"
question: "Integrar notas fiscais emitidas do Bling ao relatório Entrada x Saída conforme o período do filtro"
contributor: "graphify"
outcome: "useful"
source_nodes: ["entradaSaidaController.js", "blingClient.js"]
---

# Q: Integrar notas fiscais emitidas do Bling ao relatório Entrada x Saída conforme o período do filtro

## Answer

Criado services/blingClient.js com OAuth refresh criptografado, paginação de NF-e situação 5, filtro por data de emissão, detalhes para valorNota e limite de 3 req/s. Controller consolida separadamente Bling na empresa 5 e UI exibe total e quantidade. Credencial de refresh fornecida foi rotacionada durante validação e precisa de nova autorização para teste real final.

## Outcome

- Signal: useful

## Source Nodes

- entradaSaidaController.js
- blingClient.js