---
type: "query"
date: "2026-08-11T14:11:33.312922+00:00"
question: "Adaptar o relatório de Markup do PBIX para a aplicação com visual moderno nas cores da logo"
contributor: "graphify"
outcome: "useful"
source_nodes: ["markupController.js", "markupRoutes.js", "app.js", "menuCatalog.js", "screenPermissions.js"]
---

# Q: Adaptar o relatório de Markup do PBIX para a aplicação com visual moderno nas cores da logo

## Answer

Inspecionados os PBIX 10 MARKUP atual e 13 MARKUP histórico. Criado módulo /markup com filtros de data, empresas e vendedores; KPIs de bruto, líquido, desconto, custo, lucro, markup e margem; evolução diária; ranking por vendedor; alerta de itens sem custo. Fonte Oracle TGFCAB/TGFITE/TGFVEN, TOPs fiscais do faturamento, custo TGFITE.CUSTO vezes QTDNEG, devoluções negativas. Fórmula markup=(líquido/custo-1)*100. Teste real 2026-08-01 a 2026-08-10: 508 notas, 18 vendedores, bruto 315584,80, líquido 306949,25, custo 130552,26, markup 135,12%.

## Outcome

- Signal: useful

## Source Nodes

- markupController.js
- markupRoutes.js
- app.js
- menuCatalog.js
- screenPermissions.js