# 一键启动：postgres + agent-server + server + web
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "已从 .env.example 生成 .env，请按需填写 DASHSCOPE_API_KEY / JWT_SECRET。"
}

Write-Host "Building and starting wu-rag stack..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "启动失败。常见原因："
  Write-Host "  1) Docker Desktop 未启动"
  Write-Host "  2) agent-server 拉依赖超时：在 .env 加 UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/"
  Write-Host "  3) 查看详情：docker compose logs --tail=100"
  throw "docker compose failed (exit $LASTEXITCODE)."
}

docker compose ps
Write-Host ""
Write-Host "Web:        http://localhost:8080"
Write-Host "Nest API:   http://localhost:3000"
Write-Host "RAG docs:   http://localhost:8001/docs"
Write-Host "Postgres:   localhost:5432"
