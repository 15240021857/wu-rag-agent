# 使用官方 Python 镜像，避免构建时再从 GitHub 拉 python-build-standalone（国内常超时）
FROM python:3.14-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:bookworm-slim /usr/local/bin/uv /usr/local/bin/uvx /usr/local/bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    RAG_HOST=0.0.0.0 \
    RAG_PORT=8001 \
    RAG_RELOAD=false

# 可选：构建时传 --build-arg UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
ARG UV_INDEX_URL=
ENV UV_INDEX_URL=${UV_INDEX_URL}

COPY .python-version pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
RUN uv sync --frozen --no-dev

EXPOSE 8001

CMD ["uv", "run", "--no-dev", "rag-server"]
