import os

from dotenv import load_dotenv
from fastapi import APIRouter, File, Form, Query, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pymilvus.exceptions import MilvusException

from rag_server.db.milvus.milvus_init import MilvusUnavailableError
from rag_server.services.rag import ChatModelUnavailableError, rag_service
from rag_server.utils.utils import doc_split

load_dotenv()

router = APIRouter()


# 离线向量化入库：接收file来解析，切块，向量化，入库
# 离线入库最小链路：用户上传文档 -> nestjs 存document（document_contents表，以后换成存oss，用来预览） > fastapi /ingestDocFile > 加载file.read()/MinerU，分块(现在存Milvus，后期改存pg)，向量化入库Milvus > nestjs改document状态done
# 在线检索最小链路：用户提问 -> nestjs 存对话, 拿chatId == threadId > fastapi /search > 问题向量化 > 检索召回chunks(现在从Milvus拿，后面从pg拿) > 重排（按用户问题+召回chunks原文） > 拼prompt > 问LLM 生成流式回答> nestjs 流式返回
# 重新入库/reIngest：文档要重新切块，重新入库。取document（document_contents表，以后换成存oss） -----------先不做
@router.post("/ingestDocFile")
async def add_doc_file(
    file: UploadFile = File(...),
    name: str = Form(default="document.md"),
    kb_id: str = Form(...),
    doc_id: str = Form(...),
):
    try:
        return await rag_service.add_chunk(file, name, kb_id, doc_id)
    except (MilvusUnavailableError, MilvusException) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

# 根据file或者md_content来获取切块chunks
@router.post("/getDocChunks")
async def get_doc_chunks(
    file: UploadFile = File(default=None),
    content: str = Form(default=None),
):
    contents: str = ""
    content_name: str = ""
    if file:
        # file_type = file.content_type or "text/markdown"
        content_name = file.filename
        data = await file.read()
        contents = data.decode('utf-8-sig')
    elif content:
        contents = content
    else:
        raise HTTPException(status_code=400, detail="No file or content provided")
    split_docs = doc_split(contents, content_name or "document.md")
    return {
        "split_docs": split_docs,
    }

# 根据content来进行切分
@router.post("/addDocContent")
async def add_doc_content(
    content: str = Form(...),
    name: str = Form(default="document.md"),
    knowledge_base_id: str = Form(...),
    doc_id: str = Form(default=""),
):
    print(f"content: -----------------------{content}")
    print(f"name: -----------------------{name}")
    docs_chunks = doc_split(content, name)
    return {
        "docs_chunks": docs_chunks,
        "knowledge_base_id": knowledge_base_id,
        "doc_id": doc_id,
    }

# 在线检索
@router.post("/retrieve")
async def retrieve(
    query: str = Form(...),
    kb_id: str = Form(...),
    system_prompt: str = Form(default=""),
    doc_id: str = Form(default=""),
):
    try:
        events = rag_service.retrieve_stream(query, kb_id, system_prompt, doc_id)
    except (MilvusUnavailableError, ChatModelUnavailableError, MilvusException) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return StreamingResponse(
        events,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# 删除 milvus collection
@router.delete("/dropMilvusCollection")
async def drop_milvus_collection(collection_name: str = Query(...)):
    try:
        return rag_service.drop_milvus_collection(collection_name)
    except (MilvusUnavailableError, MilvusException) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


