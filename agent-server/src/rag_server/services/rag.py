from collections.abc import AsyncIterator
import json
import os

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI

from pymilvus import MilvusClient, Function, FunctionType
from rag_server.db.milvus.milvus_init import (
    COLLECTION_NAME,
    get_milvus_client,
    reset_milvus_client,
)
from rag_server.utils.utils import doc_split
from pymilvus import (
    AnnSearchRequest,
)


class ChatModelUnavailableError(RuntimeError):
    """对话模型客户端无法创建，通常是缺少 API Key 或 Base URL。"""


DEFAULT_SYSTEM_PROMPT = "根据资料回答，资料没有的兜底回答在资料中没找到相关内容，回答里用资料编号标注依据"
CITE_RULE = "若回答依据了某条资料，在对应句末用该资料的编号标注，格式如 [1]。编号必须与资料编号一致，不要编造资料里没有的编号。"


def build_chat_model(model_name: str = "deepseek-flash") -> ChatOpenAI:
    if model_name != "deepseek-flash":
        raise ChatModelUnavailableError(f"unsupported chat model: {model_name}")
    api_key = os.getenv("DEEPSEEK_API_KEY")
    base_url = os.getenv("DEEPSEEK_BASE_URL")
    if not api_key or not base_url:
        raise ChatModelUnavailableError(
            "DEEPSEEK_API_KEY and DEEPSEEK_BASE_URL are required for chat"
        )
    return ChatOpenAI(
        model="deepseek-flash",
        max_retries=2,
        api_key=api_key,
        base_url=base_url,
    )


class RagService:
    def __init__(self, collection_name: str = COLLECTION_NAME) -> None:
        self.collection_name = collection_name
        self.client: MilvusClient | None = None
        self.chat_model: ChatOpenAI | None = None
    # 获取milvus向量库客户端
    def get_client(self) -> MilvusClient:
        if self.client is None:
            self.client = get_milvus_client()
        return self.client
    # 获取对话主模型
    def get_chat_model(self) -> ChatOpenAI:
        if self.chat_model is None:
            self.chat_model = build_chat_model()
        return self.chat_model

    # 接收文件，切分，向量化，入库
    async def add_chunk(self, file, name: str, kb_id: str, doc_id: str):
        file_type = file.content_type or "text/markdown"
        data = await file.read()
        contents = data.decode("utf-8-sig")
        split_docs = doc_split(contents, name)
        chunk_data = [
            {
                "content": chunk.page_content,
                "kb_id": kb_id,
                "doc_id": doc_id,
            }
            for chunk in split_docs
        ]
        client = self.get_client()
        res = client.insert(
            collection_name=self.collection_name,
            data=chunk_data,
        )
        # ids 是 protobuf RepeatedScalarContainer，FastAPI 无法直接序列化
        insert_result = {
            "insert_count": int(res["insert_count"]),
            "ids": [int(pk) for pk in res["ids"]],
            "cost": int(res["cost"]),
        }
        return {
            "code": 200,
            "message": "success",
            "name": name,
            "file_type": file_type,
            "res": insert_result,
            "docs_chunks": chunk_data,
        }

    # 检索-流式。检索和建模型在返回生成器之前完成，失败由调用方转成 503。
    def retrieve_stream(
        self,
        query: str,
        kb_id: str,
        system_prompt: str = "",
        doc_id: str = "",
    ) -> AsyncIterator[str]:
        del doc_id
        print(f"{query} retrieve starting========================")
        messages, citations = self._getRetrieveMessages(query, kb_id, system_prompt)
        model = self.get_chat_model()
        return self._iter_answer_events(messages, model, citations)

    # 遍历流式请求结果，返回流式内容块
    async def _iter_answer_events(
        self,
        messages,
        model: ChatOpenAI,
        citations: list[dict[str, str | int]] | None = None,
    ) -> AsyncIterator[str]:
        if citations:
            payload = json.dumps({"citations": citations}, ensure_ascii=False)
            yield f"data: {payload}\n\n"
        try:
            async for chunk in model.astream(messages):
                text = message_chunk_text(chunk.content)
                if not text:
                    continue
                # end="" 不换行，flush=True 立刻刷到终端，否则要等缓冲区满才看得到
                print(text, end="", flush=True)
                # 把片段收成 JSON 字符串。ensure_ascii=False 让中文保持原样，而不是 \uXXXX55
                payload = json.dumps({"text": text}, ensure_ascii=False)
                # yield 把这一小段交给 HTTP 响应，函数先停在这里，下次循环再继续。
                # f"..." 是把变量嵌进字符串。SSE 规定一条事件以 data: 开头，并以一个空行（\n\n）结束，Apifox 靠这个空行切分事件
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            payload = json.dumps({"error": str(exc)}, ensure_ascii=False)
            yield f"data: {payload}\n\n"
    # 检索
    async def retrieve_invoke(
        self,
        query: str,
        kb_id: str,
        system_prompt: str = "",
        doc_id: int | None = None,
    ):
        del doc_id
        print(f"{query} retrieve starting========================")
        messages, _citations = self._getRetrieveMessages(query, kb_id, system_prompt)
        answer = await self.get_chat_model().ainvoke(messages)
        return {
            "code": 200,
            "message": "success",
            "answer": answer,
            # "res": rerank_res,
        }

    def drop_milvus_collection(self, collection_name: str):
        if not collection_name:
            return {
                "code": 400,
                "message": "collection_name is required",
            }
        client = self.get_client()
        existed = client.has_collection(collection_name)
        if existed:
            client.drop_collection(collection_name)
            if collection_name == COLLECTION_NAME:
                reset_milvus_client()
                self.client = None
        return {
            "collection_name": collection_name,
            "dropped": existed,
        }
    # 拿到rag检索并拼接资料+问题messages：检索召回-重排-拼接
    def _getRetrieveMessages(self, query: str, kb_id: str, system_prompt: str):
        dense_req = dense_request(query, kb_id, 10)
        sparse_req = sparse_request(query, kb_id, 10)
        ranker = dashscopeReranker(query)
        client = self.get_client()
        rerank_res = client.hybrid_search(
            collection_name=self.collection_name,
            reqs=[dense_req, sparse_req],
            ranker=ranker,
            limit=2,
            output_fields=["content", "kb_id", "doc_id"],
        )
        hits = rerank_res[0] if rerank_res else []
        context, citations = format_sources(hits)
        prompt = system_prompt.strip() or DEFAULT_SYSTEM_PROMPT
        material = context or "（没有检索到资料）"
        messages = [
            SystemMessage(f"{prompt}\n{CITE_RULE}"),
            HumanMessage(f"用户问题：{query}\n\n资料：\n{material}"),
        ]
        # print(f"messages:================ {messages}")
        return messages, citations

rag_service = RagService()


def format_sources(hits: object) -> tuple[str, list[dict[str, str | int]]]:
    if not isinstance(hits, list):
        return "", []
    blocks: list[str] = []
    citations: list[dict[str, str | int]] = []
    for hit in hits:
        entity = hit_entity(hit)
        content = str(entity.get("content") or "").strip()
        if not content:
            continue
        number = len(citations) + 1
        citations.append(
            {
                "documentId": str(entity.get("doc_id") or ""),
                "chunkIndex": number - 1,
                "content": content,
            }
        )
        blocks.append(f"[{number}]\n{content}")
    return "\n\n".join(blocks), citations


def hit_entity(hit: object) -> dict[str, object]:
    entity = hit.get("entity") if isinstance(hit, dict) else getattr(hit, "entity", None)
    if isinstance(entity, dict):
        return entity
    return {}

# 处理流式内容块
def message_chunk_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if isinstance(block, str):
            parts.append(block)
            continue
        if isinstance(block, dict):
            text = block.get("text")
            if isinstance(text, str):
                parts.append(text)
    return "".join(parts)


def kb_filter(kb_id: str) -> str:
    escaped = kb_id.replace("\\", "\\\\").replace('"', '\\"')
    return f'kb_id == "{escaped}"'


def dense_request(query_embedding, kb_id: str, limit=10):
    req = AnnSearchRequest(
        data=[query_embedding],
        anns_field="dense",
        param={"metric_type": "COSINE"},
        filter=kb_filter(kb_id),
        limit=limit,
    )
    return req


def sparse_request(query_embedding, kb_id: str, limit=10):
    req = AnnSearchRequest(
        data=[query_embedding],
        anns_field="sparse",
        param={"metric_type": "BM25"},
        filter=kb_filter(kb_id),
        limit=limit,
    )
    return req


def rrfRanker():
    return Function(
        name="rrf",
        input_field_names=[],
        function_type=FunctionType.RERANK,
        params={
            "reranker": "rrf",
            "k": 10,
        },
    )


def dashscopeReranker(query):
    return Function(
        name="dashscope",
        input_field_names=["content"],
        function_type=FunctionType.RERANK,
        params={
            "reranker": "model",
            "provider": "ali",
            "model_name": "gte-rerank-v2",
            "queries": [query],
            "max_client_batch_size": 128,
        },
    )
