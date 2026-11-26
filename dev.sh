#!/usr/bin/env sh
# 本机开发一键启动：postgres + Milvus + web / Nest / RAG（热更新）
#   chmod +x dev.sh && ./dev.sh
set -eu
cd "$(dirname "$0")"

command -v docker >/dev/null || { echo "未找到 docker"; exit 1; }
command -v pnpm >/dev/null || { echo "未找到 pnpm"; exit 1; }
command -v uv >/dev/null || { echo "未找到 uv"; exit 1; }

# 释放本机开发要占用的 3000 / 8001
running="$(docker compose ps --status running --services 2>/dev/null || true)"
to_stop=""
for name in web server agent-server; do
  if printf '%s\n' "$running" | grep -qx "$name"; then
    to_stop="$to_stop $name"
  fi
done
if [ -n "$to_stop" ]; then
  echo "正在停止容器中的$to_stop（postgres 继续保留）..."
  # shellcheck disable=SC2086
  docker compose stop $to_stop
fi

if [ ! -f server/.env ]; then
  cp server/.env.example server/.env
  echo "已从 server/.env.example 生成 server/.env。"
fi

echo "Starting postgres..."
docker compose up -d --wait postgres

echo "Starting Milvus..."
docker compose -f docker-compose.milvus.yml up -d

if [ ! -d web/node_modules ]; then
  (cd web && pnpm install)
fi
if [ ! -d server/node_modules ]; then
  (cd server && pnpm install)
fi

echo ""
echo "Web:       http://localhost:5173"
echo "Nest API:  http://localhost:3000"
echo "RAG docs:  http://localhost:8001/docs"
echo "Postgres:  127.0.0.1:5432"
echo "Milvus:    localhost:19530"
echo "Ctrl+C 停止三个本机进程；数据库需另行 docker compose stop。"
echo ""

# 前台同时跑三个进程，Ctrl+C 一并结束
trap 'kill 0' INT TERM
(cd web && pnpm run dev) &
(cd server && pnpm run start:dev) &
(cd agent-server && uv run rag-server) &
wait
