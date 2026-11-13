import os

from pymilvus import MilvusClient
from rag_server.schemas.milvus_schema import define_milvus_schema

COLLECTION_NAME = "rag_collection"
_client: MilvusClient | None = None


class MilvusUnavailableError(RuntimeError):
    """Milvus 未启动或连接、建库失败。"""


def get_milvus_client() -> MilvusClient:
    """首次调用时连接 Milvus，并在 collection 不存在时创建。"""
    global _client
    if _client is not None:
        return _client

    uri = os.getenv("MILVUS_URI", "http://localhost:19530")
    try:
        client = MilvusClient(uri=uri)
        if not client.has_collection(COLLECTION_NAME):
            milvus_schema, index_params = define_milvus_schema(client)
            client.create_collection(
                collection_name=COLLECTION_NAME,
                schema=milvus_schema,
                index_params=index_params,
            )
    except Exception as exc:
        raise MilvusUnavailableError(f"Milvus is unavailable at {uri}: {exc}") from exc

    _client = client
    return _client


def reset_milvus_client() -> None:
    """丢掉缓存的客户端，下次调用会重新连接并确保 collection 存在。"""
    global _client
    _client = None
