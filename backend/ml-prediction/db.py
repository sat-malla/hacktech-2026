"""
Supabase connector — production-ready CRUD + advanced query helpers.

Loads credentials from the repo-root .env (../../.env relative to this file).
Falls back to hardcoded service-role key so existing deployments keep working.

Usage:
    from db import SupabaseConnector          # preferred
    from db import Database                   # backward-compat alias

    db = SupabaseConnector()

    # Insert
    db.create("sensors", {"temp": 22.5, "humidity": 60})

    # Read with filters, column selection, ordering, pagination
    db.read(
        "users",
        select="id,name,email",
        filters={"status": "active", "age__gte": 18},
        order_by="name",
        limit=10,
        offset=0,
    )

    # Update
    db.update("readings", match={"id": 5}, payload={"temp": 23.1})

    # Delete
    db.delete("readings", match={"id": 5})
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_REMOVED = os.getenv("REMOVED")
_REMOVED = os.getenv("REMOVED")

# ---------------------------------------------------------------------------
# Defaults — env vars take priority; hardcoded values are the fallback so
# existing deployments that never set SUPABASE_API_KEY keep working.
# ---------------------------------------------------------------------------

_SUPPORTED_OPS = {"eq", "neq", "gt", "lt", "gte", "lte", "like", "ilike", "in"}


# ---------------------------------------------------------------------------
# Internal query builder
# ---------------------------------------------------------------------------

class _QueryBuilder:
    """
    Chains PostgREST filter calls onto a query object.

    Filters use Django-style ``__op`` suffixes:
        ``{"status": "active"}``        → ``.eq("status", "active")``
        ``{"age__gte": 18}``            → ``.gte("age", 18)``
        ``{"name__ilike": "%jo%"}``     → ``.ilike("name", "%jo%")``
        ``{"id__in": [1, 2, 3]}``       → ``.in_("id", [1, 2, 3])``

    Omitting the suffix defaults to ``eq``.
    """

    def __init__(self, query: Any) -> None:
        self._q = query

    def apply_filters(self, filters: dict[str, Any]) -> "_QueryBuilder":
        for raw_key, val in filters.items():
            if "__" in raw_key:
                col, op = raw_key.rsplit("__", 1)
                if op not in _SUPPORTED_OPS:
                    raise ValueError(
                        f"Unsupported filter operator '{op}'. "
                        f"Supported: {sorted(_SUPPORTED_OPS)}"
                    )
            else:
                col, op = raw_key, "eq"

            if op == "eq":
                self._q = self._q.eq(col, val)
            elif op == "neq":
                self._q = self._q.neq(col, val)
            elif op == "gt":
                self._q = self._q.gt(col, val)
            elif op == "lt":
                self._q = self._q.lt(col, val)
            elif op == "gte":
                self._q = self._q.gte(col, val)
            elif op == "lte":
                self._q = self._q.lte(col, val)
            elif op == "like":
                self._q = self._q.like(col, val)
            elif op == "ilike":
                self._q = self._q.ilike(col, val)
            elif op == "in":
                self._q = self._q.in_(col, val)

        return self

    @property
    def query(self) -> Any:
        return self._q


# ---------------------------------------------------------------------------
# Public connector
# ---------------------------------------------------------------------------

class SupabaseConnector:
    """
    Reusable Supabase client wrapper.

    All methods return a standardized dict:
        {"success": True,  "data": dict | list}
        {"success": False, "error": str, "details": Any}
    """

    def __init__(
        self,
        url: str | None = None,
        key: str | None = None,
    ) -> None:
        resolved_url = _REMOVED#url or os.environ.get("SUPABASE_URL") or 
        resolved_key = _REMOVED#key or os.environ.get("SUPABASE_API_KEY") or 

        if not resolved_url:
            raise EnvironmentError(
                "Supabase URL not found. Set SUPABASE_URL in your .env file."
            )
        if not resolved_key:
            raise EnvironmentError(
                "Supabase key not found. Set SUPABASE_API_KEY in your .env file."
            )

        self._url = resolved_url
        self._key = resolved_key
        self._client: Client | None = None
        print("Success setting up supabase")
    @property
    def client(self) -> Client:
        if self._client is None:
            self._client = create_client(self._url, self._key)
            # Set service-role key as the PostgREST Authorization header so all
            # queries bypass RLS. Required for supabase-py >=2.0.
            self._client.postgrest.auth(self._key)
        return self._client

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _ok(data: Any) -> dict:
        return {"success": True, "data": data}

    @staticmethod
    def _err(exc: Exception, details: Any = None) -> dict:
        return {"success": False, "error": str(exc), "details": details}

    # ------------------------------------------------------------------
    # CREATE
    # ------------------------------------------------------------------

    def create(self, table: str, payload: dict[str, Any]) -> dict:
        """
        Insert a single row into *table* and return the inserted record.

        Args:
            table:   Target table name.
            payload: Column → value mapping for the new row.

        Returns:
            ``{"success": True, "data": {...}}`` with the inserted row, or an
            error dict on failure.
        """
        try:
            res = self.client.table(table).insert(payload).execute()
            return self._ok(res.data[0] if res.data else {})
        except Exception as exc:
            return self._err(exc)

    # ------------------------------------------------------------------
    # READ
    # ------------------------------------------------------------------

    def read(
        self,
        table: str,
        select: str = "*",
        filters: dict[str, Any] | None = None,
        order_by: str | None = None,
        order_desc: bool = False,
        limit: int | None = None,
        offset: int | None = None,
        single: bool = False,
    ) -> dict:
        """
        Query rows from *table* with optional filtering, ordering, and pagination.

        Args:
            table:      Target table name.
            select:     Comma-separated columns to return (default ``"*"``).
            filters:    Key-value equality filters, or Django-style ``__op`` filters.
                        Examples::

                            {"status": "active"}          # eq (default)
                            {"age__gte": 18}              # >=
                            {"name__ilike": "%john%"}     # case-insensitive LIKE
                            {"id__in": [1, 2, 3]}         # IN list

            order_by:   Column name to sort by.
            order_desc: Sort descending when ``True`` (default ascending).
            limit:      Maximum number of rows to return.
            offset:     Number of rows to skip (for pagination).
            single:     Return a single dict instead of a list (raises if >1 row).

        Returns:
            ``{"success": True, "data": [...]}`` or error dict.
        """
        try:
            q = self.client.table(table).select(select)

            if filters:
                q = _QueryBuilder(q).apply_filters(filters).query

            if order_by:
                q = q.order(order_by, desc=order_desc)

            if limit is not None:
                q = q.limit(limit)

            if offset is not None:
                q = q.offset(offset)

            if single:
                res = q.single().execute()
                return self._ok(res.data)

            res = q.execute()
            return self._ok(res.data)
        except Exception as exc:
            return self._err(exc)

    # ------------------------------------------------------------------
    # UPDATE
    # ------------------------------------------------------------------

    def update(
        self,
        table: str,
        match: dict[str, Any],
        payload: dict[str, Any],
    ) -> dict:
        """
        Update rows in *table* where all *match* key=value pairs hold.

        Args:
            table:   Target table name.
            match:   Equality conditions identifying rows to update.
            payload: Column → new value mapping.

        Returns:
            ``{"success": True, "data": [...]}`` with updated rows, or error dict.
        """
        try:
            q = self.client.table(table).update(payload)
            for col, val in match.items():
                q = q.eq(col, val)
            res = q.execute()
            return self._ok(res.data)
        except Exception as exc:
            return self._err(exc)

    # ------------------------------------------------------------------
    # DELETE
    # ------------------------------------------------------------------

    def delete(self, table: str, match: dict[str, Any]) -> dict:
        """
        Delete rows from *table* where all *match* key=value pairs hold.

        Args:
            table: Target table name.
            match: Equality conditions identifying rows to delete.

        Returns:
            ``{"success": True, "data": [...]}`` with deleted rows, or error dict.
        """
        try:
            q = self.client.table(table).delete()
            for col, val in match.items():
                q = q.eq(col, val)
            res = q.execute()
            return self._ok(res.data)
        except Exception as exc:
            return self._err(exc)

    # ------------------------------------------------------------------
    # LOOKUP  (backward-compat convenience)
    # ------------------------------------------------------------------

    def lookup(self, table: str, attribute: str, value: Any) -> dict:
        """
        Return all rows where *attribute* equals *value*.

        Convenience wrapper around :meth:`read`. Kept for backward compatibility.
        """
        return self.read(table, filters={attribute: value})


# ---------------------------------------------------------------------------
# Backward-compat alias — existing code that imports `Database` keeps working.
# ---------------------------------------------------------------------------
Database = SupabaseConnector
