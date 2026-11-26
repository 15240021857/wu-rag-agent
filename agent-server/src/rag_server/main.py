from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from rag_server import __version__
from rag_server.api.rag import router
from rag_server.settings import settings
from rag_server.core.logging import setup_logging, get_logger

setup_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    base = f"http://{settings.host}:{settings.port}"
    log.info("docs: %s/docs", base)
    log.info("redoc: %s/redoc", base)
    yield


app = FastAPI(title="RAG Server", version=__version__, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/internal/rag", tags=["rags"])

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

def run() -> None:
    uvicorn.run(
        "rag_server.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )
