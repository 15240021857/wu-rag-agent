from pymilvus import DataType, Function, FunctionType,MilvusClient

EMBEDDING_DIM = 1024
# 定义milvus content schema
def define_milvus_schema(client:MilvusClient):
    # Create a new schema for the collection
    schema = client.create_schema()
    # Add primary field "id"
    schema.add_field("id", DataType.INT64, is_primary=True, auto_id=True)
    schema.add_field("kb_id", DataType.VARCHAR, max_length=64) # 知识库id，与业务库 cuid 对齐
    schema.add_field("doc_id", DataType.VARCHAR, max_length=64) # 文档id

    # Add scalar field "content" for storing textual data
    schema.add_field(
        "content",
        DataType.VARCHAR, 
        max_length=9000,
        enable_analyzer=True
    )

    # Add vector field "dense" for storing embeddings.
    # IMPORTANT: Set dim to match the exact output dimension of the embedding model.
    schema.add_field("dense", DataType.FLOAT_VECTOR, dim=EMBEDDING_DIM)
    schema.add_field("sparse", DataType.SPARSE_FLOAT_VECTOR)

    # 稠密向量函数
    dense_fn = Function(
        name="document_vector",
        function_type=FunctionType.TEXTEMBEDDING,
        input_field_names=["content"],
        output_field_names=["dense"],
        params={
            "provider": "dashscope",    
            "model_name": "text-embedding-v3",   
        }
    )
    schema.add_function(dense_fn)

    # 稀疏向量函数
    sparse_fn = Function(
        name="document_sparse_vector",
        function_type=FunctionType.BM25,
        input_field_names=["content"],
        output_field_names=["sparse"],
    )
    schema.add_function(sparse_fn)

    # 索引配置
    index_params = client.prepare_index_params()
    index_params.add_index(
        field_name="kb_id",
    )
    index_params.add_index(
        field_name="doc_id",
    )
    index_params.add_index(
        field_name="dense",
        index_type="AUTOINDEX",
        metric_type="COSINE"
    )
    index_params.add_index(
        field_name="sparse",
        index_type="SPARSE_INVERTED_INDEX",
        metric_type="BM25",
    )

    return schema, index_params