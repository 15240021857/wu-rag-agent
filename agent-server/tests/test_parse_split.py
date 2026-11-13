from fastapi.testclient import TestClient

from rag_server.main import app

client = TestClient(app)

SAMPLE = """# 安装

先准备 PostgreSQL。

## 代码示例

运行下面的函数。

```python
def add(left, right):
    return left + right
```

## 对照

| 名称 | 说明 |
| --- | --- |
| Nest | 业务后端 |
| RAG | 解析切块 |
"""


def test_parse_split_keeps_code_and_table_intact() -> None:
    response = client.post(
        "/internal/rag/parseSplit",
        json={"fileName": "guide.md", "content": SAMPLE, "maxChunkSize": 180},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["fileName"] == "guide.md"
    assert body["fileType"] == "md"
    assert body["chunkCount"] == len(body["chunks"])
    assert body["chunkCount"] >= 2
    assert body["analysis"]["headerCount"] >= 2
    assert body["analysis"]["codeBlockCount"] == 1
    assert body["analysis"]["tableCount"] == 1
    assert [item["index"] for item in body["chunks"]] == list(range(1, body["chunkCount"] + 1))

    code_chunks = [item for item in body["chunks"] if "def add(left, right):" in item["content"]]
    assert len(code_chunks) == 1
    assert "```python" in code_chunks[0]["content"]
    assert code_chunks[0]["content"].count("```") >= 2
    assert code_chunks[0]["contentType"] == "code"
    assert code_chunks[0]["hasCode"] is True

    table_chunks = [item for item in body["chunks"] if "| Nest | 业务后端 |" in item["content"]]
    assert len(table_chunks) == 1
    for item in body["chunks"]:
        assert item["charCount"] == len(item["content"])
        assert item["content"]


def test_parse_split_normalizes_newlines() -> None:
    response = client.post(
        "/internal/rag/parseSplit",
        json={"content": "\ufeff# 标题\r\n\r\n正文"},
    )
    assert response.status_code == 200
    content = response.json()["content"]
    assert content.startswith("# 标题")
    assert "\r" not in content
    assert "\ufeff" not in content


def test_parse_split_rejects_empty_text() -> None:
    response = client.post("/internal/rag/parseSplit", json={"content": "  \n\t "})
    assert response.status_code == 400
    assert response.json()["detail"] == "文件内容为空"


def test_parse_split_rejects_chunk_size() -> None:
    response = client.post(
        "/internal/rag/parseSplit",
        json={"content": "# 标题\n\n正文", "maxChunkSize": 10},
    )
    assert response.status_code == 422


def test_upload_txt() -> None:
    response = client.post(
        "/internal/rag/parseSplit/file",
        files={"file": ("note.txt", "# 标题\n\n正文".encode(), "text/plain")},
        data={"maxChunkSize": "200"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["fileType"] == "txt"
    assert body["chunks"][0]["index"] == 1
    assert "正文" in body["content"]


def test_upload_rejects_pdf() -> None:
    response = client.post(
        "/internal/rag/parseSplit/file",
        files={"file": ("a.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "仅支持 md、markdown、txt"
