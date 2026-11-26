from rag_server.services.rag import delete_count_of, doc_filter


def test_doc_filter_quotes_ids() -> None:
    assert doc_filter("kb-1", 'doc"2') == 'kb_id == "kb-1" and doc_id == "doc\\"2"'


def test_delete_count_reads_milvus_result() -> None:
    assert delete_count_of({"delete_count": 3}) == 3
    assert delete_count_of({"delete_cnt": 2}) == 2
    assert delete_count_of({}) == 0
