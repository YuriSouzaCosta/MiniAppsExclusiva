param([string]$HostName,[string]$UserName,[int]$Port,[string]$RemoteDir,[string]$Pm2App,[string]$IdentityFile)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$configPath = Join-Path $projectRoot '.env_deploy'
$config = @{}
if (Test-Path -LiteralPath $configPath) {
  foreach ($line in Get-Content -LiteralPath $configPath) {
    $value = $line.Trim()
    if (-not $value -or $value.StartsWith('#') -or -not $value.Contains('=')) { continue }
    $parts = $value.Split('=', 2)
    $config[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
  }
}

if (-not $HostName) { $HostName = if ($env:DEPLOY_SSH_HOST) { $env:DEPLOY_SSH_HOST } else { $config.DEPLOY_SSH_HOST } }
if (-not $UserName) { $UserName = if ($env:DEPLOY_SSH_USER) { $env:DEPLOY_SSH_USER } else { $config.DEPLOY_SSH_USER } }
if (-not $Port) { $Port = if ($env:DEPLOY_SSH_PORT) { [int]$env:DEPLOY_SSH_PORT } elseif ($config.DEPLOY_SSH_PORT) { [int]$config.DEPLOY_SSH_PORT } else { 2223 } }
if (-not $RemoteDir) { $RemoteDir = if ($env:DEPLOY_REMOTE_DIR) { $env:DEPLOY_REMOTE_DIR } elseif ($config.DEPLOY_REMOTE_DIR) { $config.DEPLOY_REMOTE_DIR } else { '/var/www/PROJETO' } }
if (-not $Pm2App) { $Pm2App = if ($env:DEPLOY_PM2_APP) { $env:DEPLOY_PM2_APP } elseif ($config.DEPLOY_PM2_APP) { $config.DEPLOY_PM2_APP } else { 'projeto' } }
if (-not $IdentityFile) { $IdentityFile = if ($env:DEPLOY_SSH_KEY) { $env:DEPLOY_SSH_KEY } else { $config.DEPLOY_SSH_KEY } }
if (-not $HostName) { $HostName = Read-Host 'Host/IP do servidor SFTP' }
if (-not $UserName) { $UserName = Read-Host 'Usuario SSH/SFTP' }

if ($HostName -notmatch '^[A-Za-z0-9._-]+$') { throw 'Host invalido.' }
if ($UserName -notmatch '^[A-Za-z0-9._-]+$') { throw 'Usuario invalido.' }
if ($Port -lt 1 -or $Port -gt 65535) { throw 'Porta SSH invalida.' }
if ($RemoteDir -notmatch '^/[A-Za-z0-9._/-]+$') { throw 'Diretorio remoto invalido.' }
if ($Pm2App -notmatch '^[A-Za-z0-9._-]+$') { throw 'Nome do processo PM2 invalido.' }
if ($IdentityFile) {
  $IdentityFile = [Environment]::ExpandEnvironmentVariables($IdentityFile)
  if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) { throw "Chave SSH nao encontrada: $IdentityFile" }
  $IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
}
foreach ($command in 'tar','scp','ssh') { if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Comando '$command' nao encontrado. Instale o OpenSSH Client do Windows." } }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archiveName = "projeto-deploy-$stamp.tar.gz"
$archivePath = Join-Path ([System.IO.Path]::GetTempPath()) $archiveName
$remoteArchive = "/tmp/$archiveName"
$target = "${UserName}@${HostName}"
$identityArgs = if ($IdentityFile) { @('-i', $IdentityFile) } else { @() }
$excludeArgs = @('--exclude=.git','--exclude=.git/**','--exclude=.env','--exclude=.env.*','--exclude=.env_deploy','--exclude=.secrets','--exclude=.secrets/**','--exclude=node_modules','--exclude=node_modules/**','--exclude=uploads','--exclude=uploads/**','--exclude=data','--exclude=data/**','--exclude=graphify-out','--exclude=graphify-out/**','--exclude=scratch','--exclude=scratch/**','--exclude=Microsoft','--exclude=Microsoft/**','--exclude=dist','--exclude=dist/**','--exclude=certs','--exclude=certs/**','--exclude=*.log','--exclude=*.tmp','--exclude=*.bak','--exclude=__pycache__','--exclude=**/__pycache__/**','--exclude=*.pyc','--exclude=Dockerfile','--exclude=docker-compose.yml')

try {
  Write-Host '1/4 Criando pacote somente com arquivos da aplicacao...'
  & tar -czf $archivePath @excludeArgs -C $projectRoot .
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $archivePath)) { throw 'Falha ao criar o pacote.' }
  $sizeMb = [math]::Round((Get-Item -LiteralPath $archivePath).Length / 1MB, 2)
  Write-Host "2/4 Enviando $sizeMb MB por SFTP/SCP para $target..."
  & scp -P $Port @identityArgs -- $archivePath "${target}:${remoteArchive}"
  if ($LASTEXITCODE -ne 0) { throw 'Falha no envio SFTP/SCP.' }
  Write-Host '3/4 Publicando arquivos e instalando dependencias de producao...'
  $remoteCommand = "set -e; mkdir -p '$RemoteDir'; tar -xzf '$remoteArchive' -C '$RemoteDir'; rm -f '$remoteArchive'; cd '$RemoteDir'; npm ci --omit=dev"
  & ssh -p $Port @identityArgs -- $target $remoteCommand
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao publicar ou instalar dependencias.' }
  Write-Host "4/4 Reiniciando processo PM2 '$Pm2App'..."
  & ssh -p $Port @identityArgs -- $target "cd '$RemoteDir' && pm2 restart '$Pm2App' --update-env && pm2 save"
  if ($LASTEXITCODE -ne 0) { throw 'Arquivos publicados, mas o reinicio do PM2 falhou.' }
  Write-Host "Deploy concluido: $target`:$RemoteDir" -ForegroundColor Green
} finally { if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force } }
