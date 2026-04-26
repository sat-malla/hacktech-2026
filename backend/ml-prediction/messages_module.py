"""
The ONLY write surface for the `messages` table.

Flow per the spec:
  1. Construct payload {"content": content}
  2. Confirm MCP/schema authority is reachable (block writes if not)
  3. Fetch (cached) schema for `messages` via MCPSchemaClient
  4. Validate payload strictly via messages_validator.validate_payload
  5. Insert into Supabase
  6. Return the inserted row dict

If anything fails before step 5, no row is written — and therefore no Realtime
event fires. Validation failures invalidate the schema cache (so the next call
re-fetches; protects against drift) and are logged.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from mcp_schema_client import (
    MCPSchemaClient,
    MCPUnavailableError,
    RestSchemaClient,
)
from messages_validator import PayloadValidationError, validate_payload


logger = logging.getLogger(__name__)


MESSAGES_TABLE = "messages"

_RETRYABLE_HINTS = ("timeout", "temporarily", "connection", "reset", "503", "502")
_MAX_RETRIES = 3
_BACKOFF_S = (0.5, 1.0, 2.0)


def _is_retryable(err: str) -> bool:
    e = err.lower()
    return any(h in e for h in _RETRYABLE_HINTS)


# Module-level singleton client. Lazy — instantiation requires env vars.
_client: MCPSchemaClient | None = None


def get_client() -> MCPSchemaClient:
    global _client
    if _client is None:
        _client = RestSchemaClient()
    return _client


def set_client(client: MCPSchemaClient) -> None:
    """Test seam — inject a stub MCPSchemaClient."""
    global _client
    _client = client


def insert_message(content: str) -> dict[str, Any]:
    """
    Validate and insert a message. Returns the inserted row.

    Raises:
        MCPUnavailableError: schema authority unreachable; nothing was written.
        PayloadValidationError: payload violates the schema; nothing was written.
        RuntimeError: Supabase insert failed after retries.
    """
    if not isinstance(content, str):
        raise PayloadValidationError("content must be a string")

    payload: dict[str, Any] = {"content": content}
    client = get_client()

    if not client.is_available():
        logger.warning("MCP unavailable; blocking insert (content_len=%d)", len(content))
        raise MCPUnavailableError("schema authority is not reachable; write blocked")

    schema = client.fetch_table_schema(MESSAGES_TABLE)
    try:
        sanitized = validate_payload(schema, payload)
    except PayloadValidationError as e:
        client.invalidate(MESSAGES_TABLE)
        truncated = (content[:200] + "…") if len(content) > 200 else content
        logger.error("validation failed: %s | content=%r", e, truncated)
        raise

    # Insert via the same supabase client owned by the MCPSchemaClient. We
    # narrow to RestSchemaClient here because that's the only impl that owns
    # a real .client; a future MCP-backed impl would route the insert through
    # the MCP server's exec_sql tool instead.
    if not isinstance(client, RestSchemaClient):
        raise RuntimeError(
            "current MCPSchemaClient impl does not expose a write path"
        )

    last_err: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            res = client.client.table(MESSAGES_TABLE).insert(sanitized).execute()
            row = res.data[0] if res.data else {}
            return row
        except Exception as e:  # noqa: BLE001 — supabase-py wraps many error types
            err_str = str(e)
            last_err = e
            if not _is_retryable(err_str) or attempt == _MAX_RETRIES - 1:
                break
            time.sleep(_BACKOFF_S[attempt])
            logger.warning(
                "transient insert error (attempt %d/%d): %s",
                attempt + 1, _MAX_RETRIES, err_str,
            )
    raise RuntimeError(f"insert into messages failed: {last_err}")


async def ainsert_message(content: str) -> dict[str, Any]:
    """Async wrapper — runs the blocking insert in a thread."""
    return await asyncio.to_thread(insert_message, content)
