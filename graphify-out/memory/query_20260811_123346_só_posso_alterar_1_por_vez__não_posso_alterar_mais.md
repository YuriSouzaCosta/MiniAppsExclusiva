---
type: "query"
date: "2026-08-11T12:33:46.837103+00:00"
question: "só posso alterar 1 por vez, não posso alterar mais de 1 usuário ou painel"
contributor: "graphify"
outcome: "useful"
source_nodes: ["gerenciamentoUsuariosController.js", "gerenciamentoCategoriasController.js", "index.ejs"]
---

# Q: só posso alterar 1 por vez, não posso alterar mais de 1 usuário ou painel

## Answer

Expanded via graph vocab: [admin, usuario, user, salvar, save, config]. Gerenciamento de usuários e categorias convertido para salvamento em lote. Cada tela envia todas as linhas em um único formulário e o backend aplica as mudanças em uma transação Oracle, com commit total ou rollback total.

## Outcome

- Signal: useful

## Source Nodes

- gerenciamentoUsuariosController.js
- gerenciamentoCategoriasController.js
- index.ejs