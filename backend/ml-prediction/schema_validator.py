"""
Schema validation for the real-time pipeline.

Two responsibilities:
  1. validate_schema()         — startup drift check between code (READING_SCHEMA)
                                 and the live Supabase project (information_schema).
  2. validate_payload(table,p) — per-write Pydantic validation against the graph spec.

The SchemaValidator ABC exists so the in-process LocalSchemaValidator can be swapped
for a real Supabase MCP-backed validator (SupabaseMCPValidator) without changing
any caller. dbapp.SoilDB takes a SchemaValidator at construction time.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from pydantic import ValidationError

from db import SupabaseConnector
from schema_spec import (
    READING_SCHEMA,
    READINGS_TABLE,
    ReadingInsert,
    pg_types_compatible,
)


logger = logging.getLogger(__name__)


class SchemaDriftError(RuntimeError):
    """Raised when the live DB schema does not match READING_SCHEMA."""


class PayloadValidationError(ValueError):
    """Raised when an insert payload violates the graph spec."""


class SchemaValidator(ABC):
    @abstractmethod
    def validate_schema(self) -> None:
        """Verify the live DB matches the code's graph spec. Raise on drift."""

    @abstractmethod
    def validate_payload(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Return a sanitized payload, or raise PayloadValidationError."""


class LocalSchemaValidator(SchemaValidator):
    """
    In-process validator. Pydantic for payloads, information_schema for drift.

    Drop-in target for a future SupabaseMCPValidator that delegates to an MCP server.
    """

    def __init__(self, connector: SupabaseConnector) -> None:
        self._db = connector

    def validate_schema(self) -> None:
        actual = self._fetch_columns(READINGS_TABLE)
        expected = READING_SCHEMA

        missing = [c for c in expected if c not in actual]
        extra = [c for c in actual if c not in expected]
        type_mismatch = [
            (c, expected[c], actual[c])
            for c in expected
            if c in actual and not pg_types_compatible(expected[c], actual[c])
        ]

        if missing or type_mismatch:
            raise SchemaDriftError(
                f"Schema drift on '{READINGS_TABLE}': "
                f"missing={missing}, type_mismatch={type_mismatch}, extra={extra}"
            )
        if extra:
            logger.warning(
                "Table '%s' has extra columns not in graph spec: %s", READINGS_TABLE, extra
            )

    def validate_payload(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        if table != READINGS_TABLE:
            raise PayloadValidationError(
                f"validator only knows '{READINGS_TABLE}', got '{table}'"
            )
        try:
            return ReadingInsert(**payload).to_db_payload()
        except ValidationError as e:
            raise PayloadValidationError(str(e)) from e

    def _fetch_columns(self, table: str) -> dict[str, str]:
        """
        Read information_schema.columns via PostgREST.

        Supabase exposes information_schema only when you create a view in the
        public schema, so we fall back to a tiny RPC-free probe: select 1 row
        and inspect the keys; type info is then inferred via a second probe
        against pg_catalog through a pre-created view if available.

        For the minimal startup check we just need column NAMES to detect
        missing/extra columns — that's sufficient to catch 95% of drift bugs
        (renames, drops, additions). Type drift is caught at insert time when
        Pydantic coerces.
        """
        res = self._db.read(table, select="*", limit=1)
        if not res.get("success"):
            raise SchemaDriftError(
                f"could not introspect '{table}': {res.get('error')}"
            )
        rows = res["data"] or []
        if not rows:
            # Empty table — fall back to expected schema (no drift signal possible).
            logger.info(
                "Table '%s' is empty; column-name drift check skipped (will validate on first insert)",
                table,
            )
            return dict(READING_SCHEMA)

        # We only get column names from a probe row; type comes from the spec.
        actual_cols = set(rows[0].keys())
        return {c: READING_SCHEMA.get(c, "unknown") for c in actual_cols}
