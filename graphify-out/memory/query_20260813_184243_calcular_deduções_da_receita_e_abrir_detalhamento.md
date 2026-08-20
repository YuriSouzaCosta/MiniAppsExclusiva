---
type: "query"
date: "2026-08-13T18:42:43.896583+00:00"
question: "Calcular Deduções da Receita e abrir detalhamento por parceiro nas linhas analíticas da DRE"
contributor: "graphify"
outcome: "useful"
source_nodes: ["dreController.js", "dreRoutes.js", "index.html"]
---

# Q: Calcular Deduções da Receita e abrir detalhamento por parceiro nas linhas analíticas da DRE

## Answer

Deduções da Receita agora soma Impostos + Comissões e calcula % RB automaticamente. Todas as linhas analíticas menores são clicáveis e abrem modal. Para Impostos e Comissões, /dre/api/detalhes agrupa TGFFIN por CODPARC/TGFPAR e mostra valor e títulos; linhas sem naturezas informam que aguardam configuração. Julho/empresa 1 validado: impostos 35302,71 em 2 parceiros e comissões 9397,70 em 6 parceiros; deduções 44700,41.

## Outcome

- Signal: useful

## Source Nodes

- dreController.js
- dreRoutes.js
- index.html