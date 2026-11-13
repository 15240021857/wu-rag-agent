#!/usr/bin/env sh
# 一键启动：postgres + agent-server + server + web
set -eu
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已从 .env.example 生成 .env，请按需填写 DASHSCOPE_API_KEY / JWT_SECRET。"
fi

echo "Building and starting wu-rag stack..."
docker compose up -d --build
docker compose ps

echo ""
echo "Web:        http://localhost:8080"
echo "Nest API:   http://localhost:3000"
echo "RAG docs:   http://localhost:8001/docs"
echo "Postgres:   localhost:${POSTGRES_PORT:-5432}"
