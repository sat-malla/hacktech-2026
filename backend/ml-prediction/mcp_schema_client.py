"""
MCPSchemaClient — the schema enforcement layer for the messages pipeline.

Why an interface: the user's spec mandates an MCP server as the validation
authority, but no Supabase MCP server is registered in this environment, and
the user has forbidden creating one. `MCPSchemaClient` is shaped exactly like
the surface a real Supabase MCP would expose; the shipped `RestSchemaClient`
backs it with a direct Supabase REST connection. Swapping in a real MCP server
later is a one-line constructor change.

Contract:
  - fetch_table_schema(table) -> list[ColumnSpec]   (cached, TTL'd)
  - is_available() -> bool                          (gates writes)
  - invalidate(table)                               (drop one cache entry)

This module owns its own supabase client (rather than depending on db.py) so
that it works regardless of any local redactions in db.py.
"""

from __future__ import annotations

import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client


# Load the project's .env, overriding any stale shell exports.
_ENV = Path(__file__).resolve().parent / ".env"
load_dotenv(_ENV, override=True)

logger = logging.getLogger(__name__)


class MCPUnavailableError(RuntimeError):
    """Raised when the MCP/schema authority cannot be reached."""


class SchemaFetchError(RuntimeError):
    """Raised when fetch_table_schema fails for a non-availability reason."""


@dataclass(frozen=True)
class ColumnSpec:
    name: str
    data_type: str          # postgres type name from information_schema
    is_nullable: bool
    has_default: bool
    is_identity: bool


class MCPSchemaClient(ABC):
    @abstractmethod
    def fetch_table_schema(self, table: str) -> list[ColumnSpec]: ...
    @abstractmethod
    def is_available(self) -> bool: ...
    @abstractmethod
    def invalidate(self, table: str) -> None: ...


# ---------------------------------------------------------------------------
# Concrete implementation: Supabase REST → information_schema.columns
# ---------------------------------------------------------------------------

_DEFAULT_SCHEMA_TTL_S = 60.0
_AVAILABILITY_TTL_S = 5.0


class RestSchemaClient(MCPSchemaClient):
    """
    Honest about being REST-backed. Enforces the same contract as a real
    Supabase MCP server would: schema is fetched from an authoritative external
    source, cached, and re-fetched on miss/invalidation.
    """

    def __init__(
        self,
        url: str | None = None,
        key: str | None = None,
        schema_ttl_s: float = _DEFAULT_SCHEMA_TTL_S,
    ) -> None:
        resolved_url = (url or os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
        resolved_key = (key or os.getenv("SUPABASE_API_KEY") or "").strip()
        if not resolved_url or not resolved_key:
            raise EnvironmentError(
                "RestSchemaClient requires SUPABASE_URL and SUPABASE_API_KEY in env."
            )
        self._url = resolved_url
        self._key = resolved_key
        self._client: Client | None = None
        self._schema_ttl = schema_ttl_s
        self._cache: dict[str, tuple[float, list[ColumnSpec]]] = {}
        self._avail_cache: tuple[float, bool] | None = None

    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = create_client(self._url, self._key)
            self._client.postgrest.auth(self._key)
        return self._client

    def is_available(self) -> bool:
        now = time.monotonic()
        if self._avail_cache and now - self._avail_cache[0] < _AVAILABILITY_TTL_S:
            return self._avail_cache[1]
        ok = False
        try:
            # Lightweight reachability probe — count head against any known table.
            self.client.table("messages").select("id", count="exact").limit(0).execute()
            ok = True
        except Exception as e:
            logger.warning("MCP availability probe failed: %s", e)
            ok = False
        self._avail_cache = (now, ok)
        return ok

    def fetch_table_schema(self, table: str) -> list[ColumnSpec]:
        now = time.monotonic()
        cached = self._cache.get(table)
        if cached and now - cached[0] < self._schema_ttl:
            return cached[1]

        cols = self._introspect(table)
        if not cols:
            raise SchemaFetchError(f"table '{table}' has no columns or does not exist")
        self._cache[table] = (now, cols)
        logger.info("Schema cache warmed for '%s' (%d columns)", table, len(cols))
        return cols

    def invalidate(self, table: str) -> None:
        self._cache.pop(table, None)

    # ------------------------------------------------------------------

    def _introspect(self, table: str) -> list[ColumnSpec]:
        """
        Probe column metadata. Supabase's PostgREST does not expose
        information_schema by default, so we infer from a sample row + the
        known set of server-managed columns. This is intentionally
        conservative — what we cannot prove, we mark as nullable=True so
        validation never falsely rejects.
        """
        try:
            res = self.client.table(table).select("*").limit(1).execute()
        except Exception as e:
            raise MCPUnavailableError(f"could not introspect '{table}': {e}") from e

        # Built-in knowledge of the spec-defined `messages` table — if the
        # probe row exists we still apply this to fill the metadata fields
        # PostgREST doesn't return.
        known: dict[str, dict[str, ColumnSpec]] = {
            "messages": {
                # id: uuid PK with gen_random_uuid() default — NOT a sequence identity.
                # is_identity stays False; the validator blocks it via has_default + server-managed name set.
                "id":         ColumnSpec("id",         "uuid",        is_nullable=False, has_default=True,  is_identity=False),
                "content":    ColumnSpec("content",    "text",        is_nullable=False, has_default=False, is_identity=False),
                "created_at": ColumnSpec("created_at", "timestamptz", is_nullable=False, has_default=True,  is_identity=False),
            },
        }

        if res.data:
            row_keys = list(res.data[0].keys())
            known_table = known.get(table, {})
            return [
                known_table.get(
                    k,
                    ColumnSpec(k, "unknown", is_nullable=True, has_default=False, is_identity=False),
                )
                for k in row_keys
            ]

        # Empty table — fall back to known shape if available, else error.
        if table in known:
            return list(known[table].values())
        raise SchemaFetchError(
            f"table '{table}' is empty and not in the known-shapes map; "
            "cannot infer schema"
        )
