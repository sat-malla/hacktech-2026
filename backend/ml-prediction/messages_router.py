"""
FastAPI router for the messages pipeline.

Standalone — does NOT depend on db.py / SupabaseConnector. The messages module
owns its own supabase client (via RestSchemaClient), so this router stays
loadable even if other parts of the codebase are mid-refactor.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from messages_module import MESSAGES_TABLE, get_client, insert_message
from messages_validator import PayloadValidationError
from mcp_schema_client import MCPUnavailableError, RestSchemaClient


router = APIRouter(prefix="/api/messages", tags=["Messages"])


class MessageCreate(BaseModel):
    # `extra: allow` so unknown fields reach the validator (which produces the
    # spec-required "unknown column 'X'" error), instead of being silently
    # dropped by Pydantic.
    model_config = ConfigDict(extra="allow")
    content: str = Field(..., min_length=1)


@router.post("")
def api_messages_create(body: MessageCreate) -> dict:
    """
    Validated single-write path. Returns the inserted row on success.

      200 — created
      422 — payload violates the schema (unknown column, missing field, type, ...)
      503 — schema authority (MCP/REST) unreachable; nothing was written
    """
    extras = {k: v for k, v in body.model_dump().items() if k != "content"}
    if extras:
        raise HTTPException(
            status_code=422,
            detail=f"unknown column '{next(iter(extras))}'",
        )
    try:
        return insert_message(body.content)
    except PayloadValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except MCPUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("")
def api_messages_list(limit: int = Query(default=50, ge=1, le=200)) -> list[dict]:
    """Return the most recent messages, newest first."""
    client = get_client()
    if not isinstance(client, RestSchemaClient):
        raise HTTPException(status_code=503, detail="messages backend not configured")
    res = (
        client.client.table(MESSAGES_TABLE)
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []
