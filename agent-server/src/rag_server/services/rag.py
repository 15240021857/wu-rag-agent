from collections.abc import AsyncIterator
import json
import logging
import os
import tempfile

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI

from pymilvus import MilvusClient, Function, FunctionType
from rag_server.core.logging import get_logger
from rag_server.db.milvus.milvus_init import (
    COLLECTION_NAME,
    get_milvus_client,
    reset_milvus_client,
)
from rag_server.utils.utils import doc_split, clean_mineru_tables
from pymilvus import (
    AnnSearchRequest,
)
from mineru import MinerU
from rag_server.settings import settings

log = get_logger(__name__)
class ChatModelUnavailableError(RuntimeError):
    """对话模型客户端无法创建，通常是缺少 API Key 或 Base URL。"""


DEFAULT_SYSTEM_PROMPT = "根据资料回答，资料没有的兜底回答在资料中没找到相关内容，回答里用资料编号标注依据"
# 引用编号规则提示词
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
        self.minerU: MinerU | None = None
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
    # 获取minerU实例
    def get_minerU(self) -> MinerU:
        if self.minerU is None:
            api_key=settings.mineru_api_key
            self.minerU = MinerU(api_key)
        return self.minerU

    # 接收文件，切分，向量化，入库
    async def add_chunk(self, file, name: str, kb_id: str, doc_id: str):
        md_contents, file_suffix = await self._load_file_to_markdown(file, name)
        split_docs = doc_split(md_contents, name, file_suffix)
        chunk_data = [
            {
                "content": chunk.page_content,
                "kb_id": kb_id,
                "doc_id": doc_id,
            }
            for chunk in split_docs
        ]
        log.info(f"chunk_data: {chunk_data}")
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
            "file_type": file_suffix,
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
        # 拿到检索拼接messages + 引用来源citations
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

    # 按知识库 + 文档删除向量。文档还没入库时 delete_count 为 0，也算成功。
    def delete_doc_vectors(self, kb_id: str, doc_id: str) -> dict[str, int]:
        if not kb_id or not doc_id:
            raise ValueError("kb_id and doc_id are required")
        client = self.get_client()
        if not client.has_collection(self.collection_name):
            return {"delete_count": 0}
        result = client.delete(
            collection_name=self.collection_name,
            filter=doc_filter(kb_id, doc_id),
        )
        return {"delete_count": delete_count_of(result)}

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
    # rag检索拿到拼接资料+问题messages：检索召回-重排-拼接
    def _getRetrieveMessages(self, query: str, kb_id: str, system_prompt: str):
        dense_req = dense_request(query, kb_id, 10)
        sparse_req = sparse_request(query, kb_id, 10)
        ranker = dashscopeReranker(query)
        client = self.get_client()
        # cross-encoder的方式 将稠密和稀疏检索召回结果交给千问rerank重排
        rerank_res = client.hybrid_search(
            collection_name=self.collection_name,
            reqs=[dense_req, sparse_req],
            ranker=ranker,
            limit=2,
            output_fields=["content", "kb_id", "doc_id"],
        )
        # 拿到rerank 最终chunks
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
    # 加载文件，转成md内容，注意txt后缀文件原样返回,支持md, pdf, pdf(ocr), docx, xlsx, csv, ppt等，
    async def _load_file_to_markdown(self, file, file_name: str,) -> tuple[str, str]:
        file_suffix = file.filename.split(".")[-1]
        logging.info(f"file=========================================: {file}")
        file_type_list = ["pdf", "docx", "xlsx", "csv", "ppt"]
        # 读出二进制数据
        data = await file.read()
        md_content = ""
        if file_suffix == "txt":
            txt_content = data.decode("utf-8-sig")
            return txt_content, file_suffix
        if file_suffix == "md":
            md_content = data.decode("utf-8-sig")
            return md_content, file_suffix

        if file_suffix in file_type_list:
            # ================用miner-处理文件，返回markdown内容===============
            # 先存tempfile临时文件，解析后删除
            with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_suffix}') as temp:
                temp.write(data)
                temp_path = temp.name
            try:
                # 扫描版 pdf 没有单独后缀。MinerU 只有显式传入 ocr 才会带上 is_ocr。
                if file_suffix == "pdf":
                    md_result = self.get_minerU().extract(temp_path, ocr=True)
                else:
                    md_result = self.get_minerU().extract(temp_path)
                md_content = clean_mineru_tables(md_result.markdown)

                # logging.info(f"minerU md_content=======: {md_content}")
                return md_content, file_suffix
            except Exception as e:
                logging.error(f"minerU error=======: {e}")
                return "", file_suffix
            finally:
                os.remove(temp_path)
        raise ValueError(f"unsupported file type: {file_suffix}")

rag_service = RagService()

# 从rerank最终chunks中拿到content原文 + 引用
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


def milvus_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def kb_filter(kb_id: str) -> str:
    return f"kb_id == {milvus_quote(kb_id)}"


def doc_filter(kb_id: str, doc_id: str) -> str:
    return f"kb_id == {milvus_quote(kb_id)} and doc_id == {milvus_quote(doc_id)}"


def delete_count_of(result: object) -> int:
    if isinstance(result, dict):
        raw = result.get("delete_count", result.get("delete_cnt", 0))
    else:
        raw = getattr(result, "delete_count", getattr(result, "delete_cnt", 0))
    return int(raw or 0)


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

# 阿里千问reranker
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
