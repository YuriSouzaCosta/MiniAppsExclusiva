---
type: "query"
date: "2026-08-20T19:04:19.415317+00:00"
question: "do relatorio de entrada x saida remova o modulo do bling esta pesando muito , deixa sem consultar por hora"
contributor: "graphify"
outcome: "corrected"
correction: "Para alterações recentes no Entrada x Saída, verificar diretamente controllers/entradaSaidaController.js e views/entradaSaida/index.html quando o grafo ainda não contiver os símbolos do Bling."
source_nodes: ["controller", "app.js"]
---

# Q: do relatorio de entrada x saida remova o modulo do bling esta pesando muito , deixa sem consultar por hora

## Answer

Expanded from original query via vocab: [entrada, resumo, sankhya, controller]. O grafo estava desatualizado e não continha Bling; a confirmação foi feita no código atual. Removida do entradaSaidaController a importação de blingClient, a chamada listIssuedNotes e todos os campos de resposta do Bling. Removidos da view os totais, cartões e avisos do Bling. O relatório agora consulta somente Oracle/Sankhya.

## Outcome

- Signal: corrected
- Correction: Para alterações recentes no Entrada x Saída, verificar diretamente controllers/entradaSaidaController.js e views/entradaSaida/index.html quando o grafo ainda não contiver os símbolos do Bling.

## Source Nodes

- controller
- app.js