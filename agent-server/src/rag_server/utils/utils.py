import logging
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from fastapi import HTTPException
def doc_split(content: str, file_name: str, file_suffix: str):
    documents = None
    print(f"file_suffix: {file_suffix}----------------")
    # print(f"content: {content}----------------")
    try:
        if file_suffix == "txt": # txt文件按行切分
            recursive_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=0, separators=["\n\n", "\n", " ", ""])
            documents = recursive_splitter.split_text(content)
            logging.info(f"txt file_name: {file_name}, documents length: {len(documents)}")
        else: # md 按标题切分
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
    except Exception as exc:
        logging.exception(f"split failed | file={file_name} suffix={file_suffix}")

    return documents

# 解决MinerU输出table html的问题，转为md语法
import re
from markdownify import markdownify as md
def clean_mineru_tables(raw_md: str) -> str:
    def convert(m):
        html = m.group(0)
        # 清理单元格内的 <p> 标签（MinerU 表格单元格常包 <p>）
        html = re.sub(r'</?p>', '', html)
        # 保留加粗为 Markdown 语法
        html = html.replace('<strong>', '**').replace('</strong>', '**')
        try:
            table_md = md(html, heading_style="ATX")
            table_md = table_md.replace('\\*\\*', '**')
            table_md = table_md.replace('\\*', '*')
            return f"\n{table_md}\n"
        except Exception:
            return html  # 转换失败保底

    return re.sub(r'<table.*?</table>', convert, raw_md, flags=re.S)


# md_result = self.minerU.extract(temp_path, table=True, language="ch")
# md_content = clean_mineru_tables(md_result.markdown)
# print(f"minerU md_content=============: {md_content}")
