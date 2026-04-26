"""
Readings heartbeat.

Every POLL_INTERVAL_S seconds:
  - If sensor_daemon.py has inserted a new row → advance cursor, stay silent on readings.
  - Otherwise → re-insert the last reading into `readings` (triggers Realtime for
    useLiveMetrics) AND write a JSON snapshot into `messages` (updates /api/messages
    and the MessagesFeed Realtime channel).

All DB calls run in a thread pool so the FastAPI event loop is never blocked.
"""

from __future__ import annotations

import asyncio
import json
import logging

from db import SupabaseConnector

logger = logging.getLogger(__name__)

READINGS_TABLE = "readings"
MESSAGES_TABLE = "messages"
POLL_INTERVAL_S = 5
SERVER_COLS = {"id", "timestamp"}


# ---------------------------------------------------------------------------
# Sync helpers (run inside asyncio.to_thread)
# ---------------------------------------------------------------------------

def _fetch_latest_sync(db: SupabaseConnector) -> dict | None:
    res = db.read(READINGS_TABLE, order_by="timestamp", order_desc=True, limit=1)
    rows = res.get("data") or []
    return rows[0] if rows else None


def _reinsert_reading_sync(db: SupabaseConnector, row: dict) -> dict | None:
    payload = {k: v for k, v in row.items() if k not in SERVER_COLS}
    result = db.create(READINGS_TABLE, payload)
    if result.get("success"):
        inserted = result.get("data") or {}
        logger.info(
            "heartbeat: readings re-insert ok (monitor_id=%s new_id=%s)",
            payload.get("monitor_id"),
            inserted.get("id"),
        )
        return inserted
    logger.warning("heartbeat: readings re-insert failed: %s", result.get("error"))
    return None


def _publish_message_sync(db: SupabaseConnector, row: dict) -> None:
    """Write a JSON snapshot of the reading into the messages table."""
    snapshot = {k: v for k, v in row.items() if k not in {"id"}}
    content = json.dumps(snapshot)
    result = db.create(MESSAGES_TABLE, {"content": content})
    if result.get("success"):
        logger.info("heartbeat: message published (content_len=%d)", len(content))
    else:
        logger.warning("heartbeat: message publish failed: %s", result.get("error"))


# ---------------------------------------------------------------------------
# Async wrappers
# ---------------------------------------------------------------------------

async def _fetch_latest(db: SupabaseConnector) -> dict | None:
    return await asyncio.to_thread(_fetch_latest_sync, db)

async def _reinsert_reading(db: SupabaseConnector, row: dict) -> dict | None:
    return await asyncio.to_thread(_reinsert_reading_sync, db, row)

async def _publish_message(db: SupabaseConnector, row: dict) -> None:
    await asyncio.to_thread(_publish_message_sync, db, row)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

async def run(db: SupabaseConnector) -> None:
    # Startup: fire immediately without waiting for the first sleep
    row = await _fetch_latest(db)
    if row is None:
        logger.warning("heartbeat: readings table is empty — will retry each cycle")
        last_seen_id: object = None
    else:
        last_seen_id = row.get("id")
        inserted = await _reinsert_reading(db, row)
        if inserted:
            last_seen_id = inserted.get("id")
        await _publish_message(db, row)

    while True:
        await asyncio.sleep(POLL_INTERVAL_S)
        try:
            row = await _fetch_latest(db)
            if row is None:
                logger.warning("heartbeat: readings table still empty")
                continue

            current_id = row.get("id")

            if current_id != last_seen_id:
                # Real sensor data arrived — advance cursor; publish the new row to messages
                logger.debug("heartbeat: new sensor row (id=%s)", current_id)
                last_seen_id = current_id
                await _publish_message(db, row)
            else:
                # No new sensor data — re-broadcast last row on both channels
                inserted = await _reinsert_reading(db, row)
                if inserted:
                    last_seen_id = inserted.get("id")
                await _publish_message(db, row)

        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("heartbeat error: %s", e)
