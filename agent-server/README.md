# RAG 服务

Python FastAPI 服务，依赖由 [uv](https://docs.astral.sh/uv/) 管理。当前提供 Markdown / 纯文本的解析和切块，返回结果可直接给前端做分片预览。

## 准备

在 `agent-server` 目录：

```bash
uv sync
```

## 启动

```bash
uv run rag-server
```

开发时热重载：

```bash
uv run uvicorn rag_server.main:app --reload --host 127.0.0.1 --port 8001
```

默认监听 `127.0.0.1:8001`，可用环境变量 `RAG_HOST`、`RAG_PORT`、`RAG_RELOAD` 覆盖。接口文档在 `http://127.0.0.1:8001/docs`。

Docker 内通过根目录 `docker compose up` 启动时，监听 `0.0.0.0:8001`，宿主机映射端口由根目录 `.env` 的 `RAG_PORT` 控制。

## 企业知识 agent
跑通一个“RAG + 简单判断 + 结构化输出”的闭环，再往上加 Tool Calling、人工卡点、多步骤规划，就有了真实的体感和迭代依据。你现在缺的不是技术选型，是一个具体的、有人用的场景。