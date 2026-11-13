from langchain_text_splitters import MarkdownHeaderTextSplitter
from fastapi import HTTPException
def doc_split(content: str, file_name: str):
    try:
        # 定义切分标题
        headers_to_split_on = [
            ("#", "h1"),
            ("##", "h2"),
            ("###", "h3"),
        ]   
        # 创建切分器
        markdown_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on, 
            strip_headers=False # 正文是否去除标题
        )
        # 切分内容
        documents = markdown_splitter.split_text(content)
        # 打印切分后的长度
        print(f"length :----------------{len(documents)}")
        # 设置文档id
        for i, doc in enumerate(documents):
            doc.id = f"doc_{i}"
        # 带上元数据返回
        # docs_chunks = [{
        #     "content": chunk.page_content,
        #     "metadata": chunk.metadata,
        # } for chunk in documents]
        # return docs_chunks
    except Exception as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return documents