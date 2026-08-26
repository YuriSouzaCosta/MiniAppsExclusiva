---
type: "query"
date: "2026-08-25T18:16:24.655844+00:00"
question: "Automatizar deploy do localhost por SFTP para /var/www/PROJETO com PM2 sem Docker"
contributor: "graphify"
outcome: "useful"
source_nodes: ["package.json", "app.js"]
---

# Q: Automatizar deploy do localhost por SFTP para /var/www/PROJETO com PM2 sem Docker

## Answer

Expanded via graph vocab: [docker, package, projeto]. Criado scripts/deploy-sftp.ps1 e npm run deploy. O script empacota a aplicacao com exclusoes seguras, envia por OpenSSH, extrai em /var/www/PROJETO, roda npm ci --omit=dev e reinicia o PM2. Sintaxe e pacote de exclusoes validados localmente; nenhuma conexao de deploy foi executada.

## Outcome

- Signal: useful

## Source Nodes

- package.json
- app.js