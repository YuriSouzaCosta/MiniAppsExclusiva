---
type: "query"
date: "2026-08-10T13:56:40.598394+00:00"
question: "as entrada que são as notas devem puxar tudo que estiver importado para o portal de importação xml memso que não esteja lançada ainda , pq eu preciso saber a entrada real que teve e não o que tava somente lançado"
contributor: "graphify"
outcome: "useful"
source_nodes: ["acompanhamentoNotasController.js", "entradaSaidaController.js"]
---

# Q: as entrada que são as notas devem puxar tudo que estiver importado para o portal de importação xml memso que não esteja lançada ainda , pq eu preciso saber a entrada real que teve e não o que tava somente lançado

## Answer

Expanded from original query via graph vocab: [entrada, importacao, nota, notas, xml]. A origem de entrada foi alterada de TGFCAB para TGFIXN, usando VLRNOTA e DHEMISS; inclui XML pendente e lançado e deduplica por empresa, número, série e CNPJ, mantendo a importação mais recente.

## Outcome

- Signal: useful

## Source Nodes

- acompanhamentoNotasController.js
- entradaSaidaController.js