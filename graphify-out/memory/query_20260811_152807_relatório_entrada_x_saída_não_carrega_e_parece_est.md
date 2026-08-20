---
type: "query"
date: "2026-08-11T15:28:07.377206+00:00"
question: "Relatório Entrada x Saída não carrega e parece estar em loop"
contributor: "graphify"
outcome: "useful"
source_nodes: ["entradaSaidaController.js", "blingClient.js", "index.html"]
---

# Q: Relatório Entrada x Saída não carrega e parece estar em loop

## Answer

Causa: controller aguardava Oracle e Bling no mesmo Promise.all e fetch do Bling não tinha timeout. Corrigido com timeout HTTP de 8 segundos e degradação independente: falha do Bling retorna Oracle normalmente, blingDisponivel=false e aviso visual. Teste simulando Bling offline retornou HTTP 200, entradas e saídas Sankhya preservadas e aviso de indisponibilidade.

## Outcome

- Signal: useful

## Source Nodes

- entradaSaidaController.js
- blingClient.js
- index.html