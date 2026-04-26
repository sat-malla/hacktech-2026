"""
Graph specification for the soil-monitor real-time pipeline.

This module is the SINGLE SOURCE OF TRUTH for the `readings` table shape.
Pydantic model -> validates payloads at insert time.
READING_SCHEMA   -> introspected at startup against Supabase information_schema
                    to detect drift between code and DB.

If you change the schema, edit BOTH the Pydantic model and READING_SCHEMA together,
then update sql/001_readings_realtime.sql to match.

Note: the live `readings` table uses an integer auto-increment `id` and a
`timestamp` column (not `created_at`). The spec is aligned to that reality.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


READINGS_TABLE = "readings"

# Name of the server-generated insertion-time column on `readings`.
# Centralised so a future rename touches one constant.
TIMESTAMP_COLUMN = "timestamp"


class Reading(BaseModel):
    """Canonical Reading node, mirroring the readings table 1:1."""

    model_config = ConfigDict(extra="forbid")

    id: int | None = None
    monitor_id: int = Field(..., ge=1)
    plant_species: str = Field(..., min_length=1)
    soil_moisture: float = Field(..., ge=0.0, le=100.0)
    air_temperature: float
    soil_temperature: float
    water_level: float = Field(..., ge=0.0)
    drainage: float
    timestamp: datetime | None = None

    @field_validator("plant_species")
    @classmethod
    def _strip_species(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("plant_species must be non-empty")
        return v


class ReadingInsert(BaseModel):
    """Validated payload for an INSERT — server fills id and timestamp."""

    model_config = ConfigDict(extra="forbid")

    monitor_id: int = Field(..., ge=1)
    plant_species: str = Field(..., min_length=1)
    soil_moisture: float = Field(..., ge=0.0, le=100.0)
    air_temperature: float
    soil_temperature: float
    water_level: float = Field(..., ge=0.0)
    drainage: float

    @field_validator("plant_species")
    @classmethod
    def _strip_species(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("plant_species must be non-empty")
        return v

    def to_db_payload(self) -> dict[str, Any]:
        return self.model_dump()


READING_SCHEMA: dict[str, str] = {
    "id": "bigint",
    "monitor_id": "integer",
    "plant_species": "text",
    "soil_moisture": "double precision",
    "air_temperature": "double precision",
    "soil_temperature": "double precision",
    "water_level": "double precision",
    "drainage": "double precision",
    "timestamp": "timestamp with time zone",
}


_NUMERIC_PG = {"double precision", "numeric", "real"}
_INT_PG = {"integer", "bigint", "smallint"}


def pg_types_compatible(declared: str, actual: str) -> bool:
    """True when an actual pg type is acceptable for a declared one."""
    if declared == actual:
        return True
    if declared in _NUMERIC_PG and actual in _NUMERIC_PG:
        return True
    if declared in _INT_PG and actual in _INT_PG:
        return True
    return False
