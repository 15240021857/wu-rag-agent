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

## 文件加载，预览和分块
1. 文件上传加载入库链路：
```text
用户上传文件 → NestJS（校验、鉴权）
→ 上传到阿里云OSS，得到原始文件key
→ PG写入元数据：状态=待解析，记录原始OSS信息
→ 推入BullMQ【文档解析队列】
→ 队列消费任务：调用Python服务
    → MinerU读取文件（二进制/签名url）→ 输出md
    → LangChain文本切块、Embedding
    → Milvus写入向量
→ PG更新解析状态：成功/失败
```

2. 预览文件链路：
```text
用户点击预览 → 请求 Nest /api/preview/{fileId}
→ Nest 鉴权（知识库权限）
→ 查询PG元数据：
   ① 后缀是 pdf / md / txt：
      → 代理拉取文件流 / 生成短时签名url → 返回前端
      → md/txt：前端marked渲染；pdf：pdf.js渲染
   ② 后缀是 docx/xlsx/ppt：
      → 判断是否已有缓存PDF：
          ✅ 有：直接返回缓存PDF流/签名url
          ❌ 无：提交【PDF转换队列】，PG标记转换中，前端展示loading，转换完成后刷新预览
```