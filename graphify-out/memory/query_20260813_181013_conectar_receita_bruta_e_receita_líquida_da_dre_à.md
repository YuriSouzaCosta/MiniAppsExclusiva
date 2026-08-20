---
type: "query"
date: "2026-08-13T18:10:13.524566+00:00"
question: "Conectar Receita Bruta e Receita Líquida da DRE à regra validada anteriormente"
contributor: "graphify"
outcome: "useful"
source_nodes: ["dreController.js", "dreRoutes.js", "index.html"]
---

# Q: Conectar Receita Bruta e Receita Líquida da DRE à regra validada anteriormente

## Answer

A DRE ganhou endpoint mensal por empresa/grupo. Receita Bruta soma VLRNOTA das vendas TOPs 3105/3106/3199; Receita Líquida desconta créditos 16/69/93 e devoluções TOPs 3202/3200/3204/3201, excluindo Bonificação e Vale Funcionário. A tela agora consulta e preenche valores e % RB. Empresa 1 julho/2026 validada: bruto 473843,88 e líquido 457788,03.

## Outcome

- Signal: useful

## Source Nodes

- dreController.js
- dreRoutes.js
- index.html