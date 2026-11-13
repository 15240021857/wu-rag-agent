# RAG企业知识库问答系统

## 一键启动（推荐）

启动 **postgres + agent-server + server + web**：

```powershell
# Windows（PowerShell）
.\start.ps1
```

```bash
# macOS / Linux
chmod +x start.sh
./start.sh
```

或直接：

```bash
docker compose up -d --build
```

| 服务 | 地址 |
|------|------|
| Web | http://localhost:8080 |
| Nest API | http://localhost:3000 |
| RAG /docs | http://localhost:8001/docs |
| PostgreSQL | localhost:5432 |

停止：

```bash
docker compose down
```

根目录 `.env` 由 `.env.example` 复制而来；`DASHSCOPE_API_KEY`、`JWT_SECRET` 按需填写。

## 分步启动

```bash
# 只起数据库（本机跑 Nest 时）
docker compose up -d postgres

# 可选：Milvus 向量库（与主栈网络独立）
docker compose -f docker-compose.milvus.yml up -d
```

## 本机开发

- 前端：`cd web && pnpm install && pnpm dev`
- 业务后端：`cd server && pnpm install && pnpm start:dev`（依赖 postgres）
- RAG：`cd agent-server && uv sync && uv run rag-server`

## 核心数据流转 UML时序图
文件位置：`C:\Users\wuzhenhua\.cursor\plans`