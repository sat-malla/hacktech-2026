"""
Background CSV sync — watches csv_output/ and uploads new files to the
Backboard assistant so its RAG index stays current with live sensor data.

Tracks already-uploaded filenames in .uploaded_csvs so restarts are safe
and re-uploads are skipped.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

logger = logging.getLogger(__name__)

BASE_URL = "https://app.backboard.io/api"
CSV_OUTPUT_DIR = Path(__file__).resolve().parent / "../ml-prediction/csv_output"
UPLOADED_REGISTRY = Path(__file__).resolve().parent / ".uploaded_csvs"
POLL_INTERVAL_S = 30


def _load_registry() -> set[str]:
    if UPLOADED_REGISTRY.exists():
        return set(UPLOADED_REGISTRY.read_text().splitlines())
    return set()


def _save_registry(uploaded: set[str]) -> None:
    UPLOADED_REGISTRY.write_text("\n".join(sorted(uploaded)))


def _upload_csv(filepath: Path, assistant_id: str, api_key: str) -> bool:
    try:
        with open(filepath, "rb") as f:
            resp = httpx.post(
                f"{BASE_URL}/assistants/{assistant_id}/documents",
                headers={"X-API-Key": api_key},
                files={"file": (filepath.name, f, "text/csv")},
                timeout=60,
            )
        if resp.status_code == 200:
            doc = resp.json()
            logger.info(
                "backboard: uploaded %s → doc_id=%s status=%s",
                filepath.name, doc.get("document_id"), doc.get("status"),
            )
            return True
        else:
            logger.warning("backboard: upload failed %s — %s %s", filepath.name, resp.status_code, resp.text[:200])
            return False
    except Exception as e:
        logger.error("backboard: upload error %s — %s", filepath.name, e)
        return False


async def run(assistant_id: str, api_key: str) -> None:
    """Async loop — launched as a background task in FastAPI lifespan."""
    uploaded = _load_registry()

    # Upload any files missed before this run
    if CSV_OUTPUT_DIR.exists():
        for f in sorted(CSV_OUTPUT_DIR.glob("*.csv")):
            if f.name not in uploaded:
                ok = await asyncio.to_thread(_upload_csv, f, assistant_id, api_key)
                if ok:
                    uploaded.add(f.name)
        _save_registry(uploaded)

    while True:
        await asyncio.sleep(POLL_INTERVAL_S)
        if not CSV_OUTPUT_DIR.exists():
            continue
        new_files = [
            f for f in sorted(CSV_OUTPUT_DIR.glob("*.csv"))
            if f.name not in uploaded
        ]
        for f in new_files:
            ok = await asyncio.to_thread(_upload_csv, f, assistant_id, api_key)
            if ok:
                uploaded.add(f.name)
        if new_files:
            _save_registry(uploaded)
