# Deploy por SFTP

O comando `npm run deploy` envia a aplicacao para `/var/www/PROJETO`, executa
`npm ci --omit=dev` e reinicia o processo no PM2.

## Configuracao

Edite `.env_deploy`:

```text
DEPLOY_SSH_HOST=exclusiva.intranet
DEPLOY_SSH_USER=SEU_USUARIO
DEPLOY_SSH_PORT=2223
DEPLOY_REMOTE_DIR=/var/www/PROJETO
DEPLOY_PM2_APP=projeto
DEPLOY_SSH_KEY=%USERPROFILE%\.ssh\projeto_deploy
```

O arquivo `.env_deploy` nao e enviado ao servidor nem versionado pelo Git.
Nao grave a senha nele.

## Acesso sem digitar senha

Gere uma chave exclusiva:

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\projeto_deploy"
```

Cadastre a chave publica no servidor. Esse comando pede a senha pela ultima vez:

```powershell
Get-Content "$env:USERPROFILE\.ssh\projeto_deploy.pub" | ssh -p 2223 SEU_USUARIO@exclusiva.intranet "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys"
```

Depois execute normalmente:

```powershell
npm run deploy
```

O deploy ignora `.env`, `.env_deploy`, `.secrets`, `node_modules`, `uploads`,
`data`, `.git`, caches, logs, Docker, `scratch` e `graphify-out`.
