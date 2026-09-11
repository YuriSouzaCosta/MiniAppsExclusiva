---
type: "query"
date: "2026-08-11T12:41:27.975802+00:00"
question: "relatorio Entrada x Saída ORA-01722 invalid number"
contributor: "graphify"
outcome: "corrected"
correction: "Usar NVL(portal.SERIEDOC, -1) porque SERIEDOC é NUMBER."
source_nodes: ["entradaSaidaController.js", "TGFIXN"]
---

# Q: relatorio Entrada x Saída ORA-01722 invalid number

## Answer

Expanded via graph vocab: [entrada, nota, notas, xml]. Confirmado no Oracle: TGFIXN.SERIEDOC é NUMBER e 30 registros têm valor nulo. NVL(SERIEDOC, ' ') causava conversão inválida. Corrigido para NVL(SERIEDOC, -1); consulta completa de agosto/2026 executou com 42 linhas, 52 entradas e 225 saídas.

## Outcome

- Signal: corrected
- Correction: Usar NVL(portal.SERIEDOC, -1) porque SERIEDOC é NUMBER.

## Source Nodes

- entradaSaidaController.js
- TGFIXN