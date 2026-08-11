---
type: "query"
date: "2026-08-11T15:18:17.615011+00:00"
question: "Para produtos sem preço de custo considerar metade do valor da última venda"
contributor: "graphify"
outcome: "useful"
source_nodes: ["markupController.js", "index.html"]
---

# Q: Para produtos sem preço de custo considerar metade do valor da última venda

## Answer

Implementado fallback por produto e empresa: quando TGFITE.CUSTO é zero, busca o preço líquido unitário da venda confirmada mais recente até a data final do filtro e usa 50% como custo unitário estimado. Devoluções continuam negativas. A API separa itensCustoEstimado de itensSemCusto e a tela informa ambos. Teste real de 01 a 10/08/2026 aplicou fallback a 166 itens e deixou zero sem referência; custo 144452,81 e markup 112,49%.

## Outcome

- Signal: useful

## Source Nodes

- markupController.js
- index.html