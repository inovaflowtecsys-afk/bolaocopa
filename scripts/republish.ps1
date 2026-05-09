# Script de republicacao local - Bolao da Copa
# Este script faz o build da imagem Docker e envia para o GitHub Container Registry (GHCR)

$GH_USER = "inovaflowtecsys-afk"
$IMAGE_NAME = "bolaocopa"
$TAG = "latest"
$FULL_IMAGE = "ghcr.io/${GH_USER}/${IMAGE_NAME}:${TAG}"

Write-Host "--- Iniciando processo de republicacao ---" -ForegroundColor Cyan

Write-Host "0. Validando Docker..." -ForegroundColor Yellow
docker info *> $null

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: o daemon do Docker nao esta em execucao." -ForegroundColor Red
    Write-Host "Abra o Docker Desktop e espere o status ficar 'Engine running' antes de rodar este script." -ForegroundColor Yellow
    exit 1
}

# 1. Build da imagem
Write-Host "1. Fazendo o build da imagem Docker..." -ForegroundColor Yellow
docker build -t $IMAGE_NAME .

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Falha no build da imagem." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2. Tag da imagem
Write-Host "2. Marcando a imagem para o GHCR..." -ForegroundColor Yellow
docker tag "$($IMAGE_NAME):latest" $FULL_IMAGE

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Falha ao marcar a imagem para o GHCR." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Push para o GHCR
Write-Host "3. Enviando imagem para o GHCR ($FULL_IMAGE)..." -ForegroundColor Yellow
docker push $FULL_IMAGE

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Falha ao enviar imagem. Verifique se voce esta logado com 'docker login ghcr.io'." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "--- Sucesso! A imagem esta no GHCR ---" -ForegroundColor Green
Write-Host "Agora, acesse seu VPS e rode os comandos de atualizacao (veja o DEPLOYMENT.md)." -ForegroundColor White
