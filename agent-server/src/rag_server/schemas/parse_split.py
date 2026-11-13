from pydantic import BaseModel, ConfigDict, Field

from rag_server.services.markdown_split import (
    DEFAULT_CHUNK_SIZE,
    MAX_CHUNK_SIZE,
    MIN_CHUNK_SIZE,
    ParseSplitView,
)


class ParseSplitBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    content: str
    file_name: str = Field(default="document.md", alias="fileName", max_length=255)
    max_chunk_size: int = Field(
        default=DEFAULT_CHUNK_SIZE,
        alias="maxChunkSize",
        ge=MIN_CHUNK_SIZE,
        le=MAX_CHUNK_SIZE,
    )


class ChunkItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    index: int
    content: str
    char_count: int = Field(alias="charCount")
    start_line: int = Field(alias="startLine")
    end_line: int = Field(alias="endLine")
    content_type: str = Field(alias="contentType")
    header_path: str = Field(alias="headerPath")
    header_level: int | None = Field(alias="headerLevel")
    has_code: bool = Field(alias="hasCode")
    oversize: bool


class AnalysisItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    header_count: int = Field(alias="headerCount")
    code_block_count: int = Field(alias="codeBlockCount")
    table_count: int = Field(alias="tableCount")
    list_block_count: int = Field(alias="listBlockCount")
    latex_block_count: int = Field(alias="latexBlockCount")


class ParseSplitResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    file_name: str = Field(alias="fileName")
    file_type: str = Field(alias="fileType")
    content: str
    chunk_count: int = Field(alias="chunkCount")
    strategy: str
    total_chars: int = Field(alias="totalChars")
    total_lines: int = Field(alias="totalLines")
    analysis: AnalysisItem
    chunks: list[ChunkItem]

    @classmethod
    def from_view(cls, view: ParseSplitView) -> "ParseSplitResponse":
        return cls(
            file_name=view.file_name,
            file_type=view.file_type,
            content=view.content,
            chunk_count=view.chunk_count,
            strategy=view.strategy,
            total_chars=view.total_chars,
            total_lines=view.total_lines,
            analysis=AnalysisItem(
                header_count=view.analysis.header_count,
                code_block_count=view.analysis.code_block_count,
                table_count=view.analysis.table_count,
                list_block_count=view.analysis.list_block_count,
                latex_block_count=view.analysis.latex_block_count,
            ),
            chunks=[
                ChunkItem(
                    index=item.index,
                    content=item.content,
                    char_count=item.char_count,
                    start_line=item.start_line,
                    end_line=item.end_line,
                    content_type=item.content_type,
                    header_path=item.header_path,
                    header_level=item.header_level,
                    has_code=item.has_code,
                    oversize=item.oversize,
                )
                for item in view.chunks
            ],
        )
