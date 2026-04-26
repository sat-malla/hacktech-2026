"""
FastAPI entrypoint.

Mounts:
  - db_router         (generic /api/db/* CRUD over SupabaseConnector)
  - messages_router   (validated /api/messages pipeline)

On startup, pre-warms the messages schema cache so missing-table or
unreachable-MCP errors surface immediately rather than on first request.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import SupabaseConnector
from db_router import router as db_router
from messages_router import router as messages_router
from messages_module import MESSAGES_TABLE, get_client
import readings_heartbeat


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    try:
        get_client().fetch_table_schema(MESSAGES_TABLE)
    except Exception as e:
        logger.error("messages schema pre-warm failed: %s", e)

    db = SupabaseConnector()
    heartbeat_task = asyncio.create_task(readings_heartbeat.run(db))
    logger.info("startup ok — readings heartbeat running (interval=%ds)", readings_heartbeat.POLL_INTERVAL_S)

    yield

    heartbeat_task.cancel()
    try:
        await heartbeat_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="hacktech-2026 api", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(db_router)
app.include_router(messages_router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}
