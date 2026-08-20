---
type: "query"
date: "2026-08-20T19:22:23.576880+00:00"
question: "ajusta os numeros dos card , pq os numeros tão muito grandes ficando fora de grade"
contributor: "graphify"
outcome: "useful"
source_nodes: ["card", "dashboard", "total"]
---

# Q: ajusta os numeros dos card , pq os numeros tão muito grandes ficando fora de grade

## Answer

Expanded from original query via vocab: [card, dashboard, total, totals, valor, valores]. A camada responsiva global passou a limitar valores de cards e KPIs a clamp(1.05rem, 2vw, 1.6rem) abaixo de 1280 px e clamp(1rem, 5vw, 1.35rem) abaixo de 768 px. Foram incluídos limites de largura, quebra segura, line-height compacto e algarismos tabulares para evitar que números financeiros saiam da grade.

## Outcome

- Signal: useful

## Source Nodes

- card
- dashboard
- total