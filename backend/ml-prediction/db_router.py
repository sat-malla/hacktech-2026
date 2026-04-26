"""
Database routing — FastAPI router exposing SupabaseConnector over HTTP.

Mounted into the main FastAPI app via include_router (see main.py).

Endpoints
---------
POST   /api/db/{table}/create          Insert a row
GET    /api/db/{table}                 Read rows (query params for filtering / pagination)
POST   /api/db/{table}/update          Update matching rows
DELETE /api/db/{table}                 Delete matching rows
POST   /api/db/{table}/lookup          Single-attribute exact lookup

All responses follow the standardised format from SupabaseConnector:
    {"success": true,  "data": ...}
    {"success": false, "error": "...", "details": ...}

Note: writes to the `readings` table are intentionally rejected here — they MUST
flow through dbapp.SoilDB.insert_reading so the graph-spec validator runs.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from db import SupabaseConnector
from schema_spec import READINGS_TABLE


router = APIRouter(prefix="/api/db", tags=["Database"])

db = SupabaseConnector()

# `messages` is also a typed/validated table; block generic /api/db writes for it.
MESSAGES_TABLE = "messages"


class CreateRequest(BaseModel):
    payload: dict[str, Any]


class UpdateRequest(BaseModel):
    match: dict[str, Any]
    payload: dict[str, Any]


class DeleteRequest(BaseModel):
    match: dict[str, Any]


class LookupRequest(BaseModel):
    attribute: str
    value: Any


_VALIDATED_TABLES = {READINGS_TABLE, MESSAGES_TABLE}


def _guard_validated_table(table: str) -> None:
    if table in _VALIDATED_TABLES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Writes to '{table}' must go through the typed connector "
                "(SoilDB.insert_reading or messages_module.insert_message). "
                "Generic /api/db/* mutations are blocked here to enforce "
                "schema validation."
            ),
        )


@router.post("/{table}/create")
def api_db_create(table: str, body: CreateRequest) -> dict:
    """Insert a row into *table*. Body: ``{"payload": {col: val, ...}}``."""
    _guard_validated_table(table)
    return db.create(table, body.payload)


@router.get("/{table}")
async def api_db_read(
    table: str,
    request: Request,
    select: str = Query(default="*", description="Comma-separated columns"),
    order_by: str | None = Query(default=None),
    order_desc: bool = Query(default=False),
    limit: int | None = Query(default=None, ge=1),
    offset: int | None = Query(default=None, ge=0),
) -> dict:
    """
    Read rows from *table*.

    Any query parameter not listed above is treated as an equality filter.
    Supports Django-style ``__op`` suffixes for advanced filtering::

        GET /api/db/users?status=active&age__gte=18&select=id,name&limit=20&offset=0
    """
    reserved = {"select", "order_by", "order_desc", "limit", "offset"}
    raw_filters = {
        k: v
        for k, v in request.query_params.items()
        if k not in reserved
    }

    filters: dict[str, Any] = {}
    for k, v in raw_filters.items():
        op = k.rsplit("__", 1)[-1] if "__" in k else "eq"
        if op in {"gt", "lt", "gte", "lte"}:
            try:
                filters[k] = float(v) if "." in v else int(v)
            except ValueError:
                filters[k] = v
        elif op == "in":
            filters[k] = [x.strip() for x in v.split(",")]
        else:
            filters[k] = v

    return db.read(
        table,
        select=select,
        filters=filters or None,
        order_by=order_by,
        order_desc=order_desc,
        limit=limit,
        offset=offset,
    )


@router.post("/{table}/update")
def api_db_update(table: str, body: UpdateRequest) -> dict:
    """Update rows in *table* matching ``body.match`` with values in ``body.payload``."""
    _guard_validated_table(table)
    return db.update(table, body.match, body.payload)


@router.delete("/{table}")
def api_db_delete(table: str, body: DeleteRequest) -> dict:
    """Delete rows in *table* matching all key=value pairs in ``body.match``."""
    _guard_validated_table(table)
    return db.delete(table, body.match)


@router.post("/{table}/lookup")
def api_db_lookup(table: str, body: LookupRequest) -> dict:
    """Return all rows where ``body.attribute`` equals ``body.value``."""
    return db.lookup(table, body.attribute, body.value)
