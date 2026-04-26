"""
Database routing — FastAPI router exposing SupabaseConnector over HTTP.

Mounted into the main FastAPI app via include_router.

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
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from db import SupabaseConnector

router = APIRouter(prefix="/api/db", tags=["Database"])

db = SupabaseConnector()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/{table}/create")
def api_db_create(table: str, body: CreateRequest) -> dict:
    """Insert a row into *table*. Body: ``{"payload": {col: val, ...}}``."""
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

    # Coerce numeric strings for range and IN filters
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
    return db.update(table, body.match, body.payload)


@router.delete("/{table}")
def api_db_delete(table: str, body: DeleteRequest) -> dict:
    """Delete rows in *table* matching all key=value pairs in ``body.match``."""
    return db.delete(table, body.match)


@router.post("/{table}/lookup")
def api_db_lookup(table: str, body: LookupRequest) -> dict:
    """Return all rows where ``body.attribute`` equals ``body.value``."""
    return db.lookup(table, body.attribute, body.value)


# ---------------------------------------------------------------------------
# Domain helper (kept from original dbapp.py)
# ---------------------------------------------------------------------------

def create_log_record(data: dict[str, Any]) -> dict:
    """Insert a sensor reading row. Convenience wrapper used by sensor_daemon."""
    MONITOR_ID = 1 # will be used to link to the monitor table in the future when we have multiple monitors
    renamed = {}
    plant = db.lookup("monitors", "id", MONITOR_ID)["data"][0]["plant"]
    print(plant)
    renamed["plant_species"] = plant
    
    renamed['monitor_id'] = MONITOR_ID
    renamed["soil_moisture"] = data.get("soil_percent")
    
    renamed["air_temperature"] = (lambda c: (c * 1.8) + 32 )(data.get("temperature_c"))
    renamed["soil_temperature"] = renamed["air_temperature"] * 0.9
    renamed["water_level"] = data.get("water_inches")
    # drainage value - subtract soil moisture from last reading and divide by time
    DRAINAGE_CONSTANT = 0.08 
    if len(db.read("readings", filters={"monitor_id": MONITOR_ID})["data"]) > 0:
        last_moisture = db.read("readings", filters={"monitor_id": MONITOR_ID})["data"][-1]["soil_moisture"]
        moisture_diff = last_moisture - renamed["soil_moisture"]
    else:
        moisture_diff = 0
    
    renamed["drainage"] = (moisture_diff * 6 * DRAINAGE_CONSTANT * renamed["air_temperature"]) / (60)

    # Predict humidity from soil moisture and air temperature.
    # Formula: humidity = clamp(0, 100, 0.5 * soil_moisture + (30 - temp_c) * 0.7 + 25)
    temp_c = (renamed["air_temperature"] - 32) / 1.8
    renamed["humidity"] = max(0.0, min(100.0, 0.5 * renamed["soil_moisture"] + (30 - temp_c) * 0.7 + 25))

    renamed["methane"] = float(data.get("mq2_percent") or 0)

    return db.create("readings", renamed)
