---
type: "query"
date: "2026-08-11T13:34:41.540328+00:00"
question: "Corrigir autenticação e vinculação do Bling da SG no Entrada x Saída"
contributor: "graphify"
outcome: "useful"
source_nodes: ["entradaSaidaController.js", "blingClient.js"]
---

# Q: Corrigir autenticação e vinculação do Bling da SG no Entrada x Saída

## Answer

Credenciais atualizadas localmente; integração vinculada à CODEMP 2 SG Utilidades; refresh OAuth serializado para evitar rotação concorrente; limitador global de 360ms mantém menos de 3 requisições por segundo. Teste real de 2026-08-01 retornou 28 NF-e, total 2589,45, todas situação 5 e dentro do período.

## Outcome

- Signal: useful

## Source Nodes

- entradaSaidaController.js
- blingClient.js