---
type: "query"
date: "2026-08-11T13:54:24.653645+00:00"
question: "Painel Entrada x Saída não consulta nem mostra os valores do Bling no período"
contributor: "graphify"
outcome: "useful"
source_nodes: ["app.js", "entradaSaidaController.js", "blingClient.js"]
---

# Q: Painel Entrada x Saída não consulta nem mostra os valores do Bling no período

## Answer

Expanded from graph vocabulary: app controller route environment. Causa confirmada na configuração: docker-compose carregava somente .env, portanto o painel em container não recebia .env.bling; o token persistente também não tinha volume. Corrigidos env_file .env.bling, volume .secrets e .dockerignore para não incorporar segredos na imagem. É necessário recriar o container para a configuração entrar em vigor.

## Outcome

- Signal: useful

## Source Nodes

- app.js
- entradaSaidaController.js
- blingClient.js