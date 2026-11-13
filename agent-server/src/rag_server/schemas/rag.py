from pydantic import BaseModel

# 文章类型
class docItem(BaseModel):
    content: str
    kb_id: str
    doc_id: str

# 分块类型
class chunkItem(BaseModel):
    pass