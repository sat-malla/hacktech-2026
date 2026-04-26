"""
Pure schema-validation function. No I/O, no side effects.

`validate_payload(schema, payload)` enforces the five spec rules in order:

  1. Every payload key MUST exist in the schema (no unknown columns).
  2. No extra fields beyond the schema (subset of rule 1, kept distinct so the
     error message is specific).
  3. Every required column (NOT NULL, no default, not identity) MUST be present.
  4. Each value's Python type must be assignable to the column's pg type.
  5. Server-managed columns (defaults like `created_at`/`id`) are rejected
     unless the caller explicitly opts in via `allow_server_columns=True`.

Raises PayloadValidationError with a specific reason on the first violation.
Returns the sanitized payload (currently identity — kept as a return value so
future coercions e.g. ISO string -> datetime can land here without API change).
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Any
from uuid import UUID

from mcp_schema_client import ColumnSpec


class PayloadValidationError(ValueError):
    pass


# Mapping of postgres data types -> tuple of acceptable Python types.
# Conservative: anything matching ANY type in the tuple is accepted.
_PG_TYPE_MAP: dict[str, tuple[type, ...]] = {
    "text":          (str,),
    "varchar":       (str,),
    "character varying": (str,),
    "uuid":          (str, UUID),
    "int":           (int,),
    "int2":          (int,),
    "int4":          (int,),
    "int8":          (int,),
    "smallint":      (int,),
    "integer":       (int,),
    "bigint":        (int,),
    "float4":        (float, int),
    "float8":        (float, int),
    "real":          (float, int),
    "double precision": (float, int),
    "numeric":       (float, int),
    "boolean":       (bool,),
    "bool":          (bool,),
    "json":          (dict, list, str),
    "jsonb":         (dict, list, str),
    "timestamp":     (datetime, str),
    "timestamptz":   (datetime, str),
    "timestamp with time zone": (datetime, str),
    "date":          (date, str),
    "unknown":       (object,),
}


def _python_type_ok(pg_type: str, value: Any) -> bool:
    accept = _PG_TYPE_MAP.get(pg_type.lower(), (object,))
    # bool is a subclass of int — exclude unless the column actually expects bool.
    if isinstance(value, bool) and bool not in accept:
        return False
    return isinstance(value, accept)


def validate_payload(
    schema: list[ColumnSpec],
    payload: dict[str, Any],
    *,
    allow_server_columns: bool = False,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise PayloadValidationError("payload must be a dict")

    cols_by_name = {c.name: c for c in schema}

    # Rules 1 & 2 — every key in payload exists in schema, no extras.
    for key in payload:
        if key not in cols_by_name:
            raise PayloadValidationError(f"unknown column '{key}'")

    # Rule 5 — server-managed columns may not be overridden by default.
    if not allow_server_columns:
        for key in payload:
            col = cols_by_name[key]
            if col.is_identity or (col.has_default and col.name in {"id", "created_at", "updated_at"}):
                raise PayloadValidationError(
                    f"'{col.name}' is server-managed and cannot be set by the caller"
                )

    # Rule 3 — every required column is present.
    for col in schema:
        if col.name in payload:
            continue
        is_required = (
            not col.is_nullable
            and not col.has_default
            and not col.is_identity
        )
        if is_required:
            raise PayloadValidationError(f"missing required column '{col.name}'")

    # Rule 4 — type check.
    for key, value in payload.items():
        col = cols_by_name[key]
        if value is None:
            if not col.is_nullable:
                raise PayloadValidationError(f"column '{key}' may not be null")
            continue
        if not _python_type_ok(col.data_type, value):
            raise PayloadValidationError(
                f"column '{key}' expects {col.data_type}, got {type(value).__name__}"
            )

    return dict(payload)
