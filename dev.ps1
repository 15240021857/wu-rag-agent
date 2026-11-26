# 本机开发一键启动（热更新，不把 web / Nest / RAG 打进容器）
#
#   .\dev.ps1
#
# 会做的事：
#   1. docker compose 只起 postgres
#   2. docker compose -f docker-compose.milvus.yml 起 Milvus
#   3. 新开三个终端：web (pnpm dev)、server (pnpm start:dev)、agent-server (uv run rag-server)
#
# 若之前用 .\start.ps1 起过整栈，本脚本会停掉容器里的 web / server / agent-server，
# 避免占用 3000、8001。postgres 数据卷保留。

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Assert-Command {
  param([string]$Name, [string]$Hint)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "未找到命令 $Name。$Hint"
  }
}

Assert-Command "docker" "请先安装并启动 Docker Desktop。"
Assert-Command "pnpm" "前端和 Nest 使用 pnpm：https://pnpm.io/installation"
Assert-Command "uv" "RAG 服务使用 uv：https://docs.astral.sh/uv/"

# 整栈容器占用的是本机开发要用的端口：Nest 3000、RAG 8001。
$running = @(docker compose ps --status running --services 2>$null)
$appContainers = @($running | Where-Object { $_ -in @("web", "server", "agent-server") })
if ($appContainers.Count -gt 0) {
  Write-Host "正在停止容器中的 $($appContainers -join ', ')（释放 3000 / 8001，postgres 继续保留）..."
  docker compose stop @appContainers
  if ($LASTEXITCODE -ne 0) { throw "停止应用容器失败 (exit $LASTEXITCODE)。" }
}

if (-not (Test-Path "server\.env")) {
  Copy-Item "server\.env.example" "server\.env"
  Write-Host "已从 server\.env.example 生成 server\.env。"
}

Write-Host "Starting postgres..."
docker compose up -d --wait postgres
if ($LASTEXITCODE -ne 0) {
  Write-Host "postgres 启动失败。请确认 Docker Desktop 已运行：docker compose logs postgres"
  throw "docker compose postgres failed (exit $LASTEXITCODE)."
}

Write-Host "Starting Milvus (etcd + minio + standalone，首次拉取镜像较慢)..."
docker compose -f docker-compose.milvus.yml up -d
if ($LASTEXITCODE -ne 0) {
  Write-Host "Milvus 启动失败：docker compose -f docker-compose.milvus.yml logs --tail=80"
  throw "docker compose milvus failed (exit $LASTEXITCODE)."
}

if (-not (Test-Path "web\node_modules")) {
  Write-Host "web 依赖未安装，正在 pnpm install..."
  Push-Location "web"
  pnpm install
  if ($LASTEXITCODE -ne 0) { throw "web pnpm install failed." }
  Pop-Location
}

if (-not (Test-Path "server\node_modules")) {
  Write-Host "server 依赖未安装，正在 pnpm install..."
  Push-Location "server"
  pnpm install
  if ($LASTEXITCODE -ne 0) { throw "server pnpm install failed." }
  Pop-Location
}

$webDir = Join-Path $PSScriptRoot "web"
$serverDir = Join-Path $PSScriptRoot "server"
$ragDir = Join-Path $PSScriptRoot "agent-server"

# Windows Terminal 把三个进程分到三个标签，日志互不混在一起。
# 没有 wt 时退回三个独立 PowerShell 窗口。
if (Get-Command "wt" -ErrorAction SilentlyContinue) {
  wt -w -1 `
    new-tab --title "web" -d $webDir powershell -NoExit -Command "pnpm run dev" `; `
    new-tab --title "server" -d $serverDir powershell -NoExit -Command "pnpm run start:dev" `; `
    new-tab --title "rag" -d $ragDir powershell -NoExit -Command "uv run rag-server"
  if ($LASTEXITCODE -ne 0) { throw "无法打开 Windows Terminal (exit $LASTEXITCODE)。" }
} else {
  Start-Process powershell -WorkingDirectory $webDir -ArgumentList "-NoExit", "-Command", "pnpm run dev"
  Start-Process powershell -WorkingDirectory $serverDir -ArgumentList "-NoExit", "-Command", "pnpm run start:dev"
  Start-Process powershell -WorkingDirectory $ragDir -ArgumentList "-NoExit", "-Command", "uv run rag-server"
}

Write-Host ""
Write-Host "本机开发已拉起（三个终端里看日志）："
Write-Host "  Web (Vite):  http://localhost:5173"
Write-Host "  Nest API:    http://localhost:3000"
Write-Host "  RAG docs:    http://localhost:8001/docs"
Write-Host "  Postgres:    127.0.0.1:5432"
Write-Host "  Milvus:      localhost:19530   （健康检查约 1 分钟，Attu http://localhost:8000）"
Write-Host ""
Write-Host "停应用：关掉 web / server / rag 三个终端。"
Write-Host "停数据库：docker compose stop postgres"
Write-Host "停 Milvus：docker compose -f docker-compose.milvus.yml stop"
