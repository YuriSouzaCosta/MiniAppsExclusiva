---
type: "query"
date: "2026-08-25T19:40:31.070597+00:00"
question: "Analisar PBIX 11 - TRANSFERENCIA ENTRE LOJAS e criar relatorio web moderno e simplificado"
contributor: "graphify"
outcome: "useful"
source_nodes: ["analiseTransferenciasController.js", "analiseTransferenciasRoutes.js"]
---

# Q: Analisar PBIX 11 - TRANSFERENCIA ENTRE LOJAS e criar relatorio web moderno e simplificado

## Answer

Expanded via graph vocab: [transferencias, lojas, estoque, analise, relatorio]. O PBIX possui paginas TOTALIZADOR, EXC, PRIME, DECORA, SITE e ITENS, com saldos entre lojas, series mensais e produtos. O modulo foi modernizado em uma tela unica usando TGFCAB/TGFITE com AD_TRANSF_YSC=S, evitando o fan-out da view antiga. Inclui KPIs, fluxos origem-destino, evolucao mensal, itens, filtros multiplos e CSV. Validado no Oracle: 8 transferencias, 612 itens, 7 produtos e 3 rotas em 2026.

## Outcome

- Signal: useful

## Source Nodes

- analiseTransferenciasController.js
- analiseTransferenciasRoutes.js