from dataclasses import dataclass
from pathlib import Path

from chunkana import ChunkerConfig, MarkdownChunker
from chunkana.exceptions import ChunkanaError
from chunkana.types import Chunk, ContentAnalysis

TEXT_EXTENSIONS = frozenset({"md", "markdown", "txt"})
MIN_CHUNK_SIZE = 100
MAX_CHUNK_SIZE = 4000
DEFAULT_CHUNK_SIZE = 1024


class SplitError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class ChunkView:
    index: int
    content: str
    char_count: int
    start_line: int
    end_line: int
    content_type: str
    header_path: str
    header_level: int | None
    has_code: bool
    oversize: bool


@dataclass(frozen=True)
class AnalysisView:
    header_count: int
    code_block_count: int
    table_count: int
    list_block_count: int 
    latex_block_count: int 


@dataclass(frozen=True)
class ParseSplitView:
    file_name: str
    file_type: str
    content: str
    chunk_count: int
    strategy: str
    total_chars: int
    total_lines: int
    analysis: AnalysisView
    chunks: list[ChunkView]


def normalize_document(text: str) -> str:
    return text.replace("\ufeff", "").replace("\r\n", "\n").replace("\r", "\n").strip()


def file_type_of(file_name: str) -> str:
    suffix = Path(file_name).suffix.lower().lstrip(".")
    if suffix in TEXT_EXTENSIONS:
        return suffix
    if suffix:
        raise SplitError("仅支持 md、markdown、txt")
    return "md"


def decode_upload(data: bytes, file_name: str, max_bytes: int) -> tuple[str, str]:
    if len(data) > max_bytes:
        raise SplitError("文件不能超过 8MB", 413)
    file_type = file_type_of(file_name)
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise SplitError("请使用 UTF-8 编码的文本文件") from exc
    return file_type, text


def split_markdown(
    text: str,
    file_name: str,
    max_chunk_size: int = DEFAULT_CHUNK_SIZE,
    max_bytes: int = 8 * 1024 * 1024,
) -> ParseSplitView:
    if max_chunk_size < MIN_CHUNK_SIZE or max_chunk_size > MAX_CHUNK_SIZE:
        raise SplitError("单片最大字符数需在 100 到 4000 之间")
    file_type = file_type_of(file_name)
    print(f"file_type: {file_type}")
    print(f"text: -------------{text}")
    content = normalize_document(text)
    print(f"content: ----------------{content}")
    if not content:
        raise SplitError("文件内容为空")
    if len(content.encode("utf-8")) > max_bytes:
        raise SplitError("文件不能超过 8MB", 413)

    config = ChunkerConfig(
        max_chunk_size=max_chunk_size,
        min_chunk_size=max(1, min(512, max_chunk_size // 2)),
        overlap_size=0,
        preserve_atomic_blocks=True,
        preserve_latex_blocks=True,
    )
    try:
        chunks, strategy, analysis = MarkdownChunker(config).chunk_with_analysis(content)
    except (ChunkanaError, ValueError) as exc:
        raise SplitError(f"切块失败：{exc}") from exc
    if not chunks:
        raise SplitError("没有可切分的文本")

    views = [_to_chunk(item, index) for index, item in enumerate(chunks, start=1)]
    if len(views) > 2000:
        raise SplitError("分片超过 2000，请增大单片字符数后重试")

    return ParseSplitView(
        file_name=Path(file_name).name or "document.md",
        file_type=file_type,
        content=content,
        chunk_count=len(views),
        strategy=strategy,
        total_chars=analysis.total_chars if analysis else len(content),
        total_lines=analysis.total_lines if analysis else content.count("\n") + 1,
        analysis=_to_analysis(analysis),
        chunks=views,
    )


def _to_chunk(item: Chunk, index: int) -> ChunkView:
    metadata = item.metadata or {}
    content = item.content
    content_type = str(metadata.get("content_type") or "text")
    header_path = str(metadata.get("header_path") or "")
    level = metadata.get("header_level")
    header_level = level if isinstance(level, int) else None
    if not header_path:
        title, inferred = _opening_heading(content)
        if title:
            header_path = f"/{title}"
            header_level = header_level if header_level is not None else inferred
    return ChunkView(
        index=index,
        content=content,
        char_count=len(content),
        start_line=item.start_line,
        end_line=item.end_line,
        content_type=content_type,
        header_path=header_path,
        header_level=header_level,
        has_code=bool(metadata.get("has_code", False)) or content_type == "code",
        oversize=bool(metadata.get("allow_oversize", False)),
    )


def _opening_heading(content: str) -> tuple[str, int | None]:
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("```") or stripped.startswith("~~~"):
            return "", None
        marks, _, title = stripped.partition(" ")
        if marks and set(marks) == {"#"} and title.strip():
            return title.strip(), len(marks)
        return "", None
    return "", None


def _to_analysis(analysis: ContentAnalysis | None) -> AnalysisView:
    if analysis is None:
        return AnalysisView(0, 0, 0, 0, 0)
    return AnalysisView(
        header_count=analysis.header_count,
        code_block_count=analysis.code_block_count,
        table_count=analysis.table_count,
        list_block_count=len(analysis.list_blocks),
        latex_block_count=analysis.latex_block_count,
    )
