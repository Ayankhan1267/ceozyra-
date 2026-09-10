"""
ZYRA AI Gateway — Tenant context and memory
Provides tenant-scoped business context for AI requests.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import psycopg2.pool

from config.settings import get_settings

logger = logging.getLogger("zyra.tenant.context")

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def _init_pool() -> psycopg2.pool.ThreadedConnectionPool | None:
    global _pool
    if _pool is None:
        settings = get_settings()
        dsn = settings.database_url_resolved
        if not dsn:
            logger.warning("No DATABASE_URL configured — tenant context will be empty.")
            return None
        try:
            _pool = psycopg2.pool.ThreadedConnectionPool(1, 5, dsn)
        except Exception as exc:
            logger.warning("Could not init DB pool for tenant context: %s", exc)
            return None
    return _pool


def _get_conn():
    pool = _init_pool()
    if pool is None:
        return None
    return pool.getconn()


def _put_conn(conn) -> None:
    if _pool is not None and conn is not None:
        _pool.putconn(conn)


class TenantContext:
    """Holds tenant-specific data for AI requests."""

    def __init__(self, tenant_id: str, tenant_slug: str | None = None):
        self.tenant_id = tenant_id
        self.tenant_slug = tenant_slug
        self._metrics: dict[str, Any] = {}
        self._load_time: datetime | None = None

    @property
    def is_loaded(self) -> bool:
        return bool(self._metrics)

    def load(self) -> None:
        self._load_time = datetime.utcnow()
        self._metrics = self._fetch_metrics()

    def _fetch_metrics(self) -> dict[str, Any]:
        conn = _get_conn()
        if conn is None:
            return {}

        try:
            now = datetime.utcnow()
            start_30 = (now - timedelta(days=30)).isoformat()
            end_now = now.isoformat()

            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COALESCE(SUM("total"), 0) AS revenue, COUNT(*) AS order_count
                    FROM "orders"
                    WHERE "tenantId" = %s AND "createdAt" >= %s AND "createdAt" < %s
                    """,
                    (self.tenant_id, start_30, end_now),
                )
                rev_row = dict(zip([d[0] for d in cur.description], cur.fetchone() or []))

                cur.execute(
                    'SELECT COUNT(*) AS cnt FROM "products" WHERE "tenantId" = %s AND "isActive" = true',
                    (self.tenant_id,),
                )
                prod_row = dict(zip([d[0] for d in cur.description], cur.fetchone() or []))

                cur.execute(
                    'SELECT COUNT(*) AS cnt FROM "customers" WHERE "tenantId" = %s',
                    (self.tenant_id,),
                )
                cust_row = dict(zip([d[0] for d in cur.description], cur.fetchone() or []))

                cur.execute(
                    """
                    SELECT COALESCE(SUM("amount"), 0) AS total_commission, COUNT(*) AS cnt
                    FROM "commissions"
                    WHERE "tenantId" = %s AND "createdAt" >= %s AND "createdAt" < %s
                    """,
                    (self.tenant_id, start_30, end_now),
                )
                comm_row = dict(zip([d[0] for d in cur.description], cur.fetchone() or []))

            return {
                "revenue_30d": float(rev_row.get("revenue") or 0),
                "orders_30d": int(rev_row.get("order_count") or 0),
                "active_products": int(prod_row.get("cnt") or 0),
                "total_customers": int(cust_row.get("cnt") or 0),
                "commissions_30d": float(comm_row.get("total_commission") or 0),
            }
        except Exception as exc:
            logger.error("Failed to fetch tenant context for %s: %s", self.tenant_id, exc)
            return {}
        finally:
            _put_conn(conn)

    def to_dict(self) -> dict[str, Any]:
        if not self._metrics:
            self.load()
        return {
            "tenant_id": self.tenant_id,
            "tenant_slug": self.tenant_slug,
            "loaded_at": self._load_time.isoformat() if self._load_time else None,
            **self._metrics,
        }

    def to_prompt_context(self) -> str:
        m = self._metrics or {}
        return (
            f"Tenant ID: {self.tenant_id}. "
            f"Revenue (last 30 days): ${m.get('revenue_30d', 0):,.2f}. "
            f"Orders (last 30 days): {m.get('orders_30d', 0)}. "
            f"Active products: {m.get('active_products', 0)}. "
            f"Total customers: {m.get('total_customers', 0)}. "
            f"Commissions (last 30 days): ${m.get('commissions_30d', 0):,.2f}. "
            f"Current date: {datetime.utcnow().strftime('%Y-%m-%d')}."
        )


class TenantContextStore:
    """Caches tenant contexts to avoid repeated DB queries."""

    def __init__(self, ttl_seconds: int = 300):
        self._cache: dict[str, tuple[TenantContext, datetime]] = {}
        self._ttl = timedelta(seconds=ttl_seconds)

    def get(self, tenant_id: str, tenant_slug: str | None = None) -> TenantContext:
        cached = self._cache.get(tenant_id)
        now = datetime.utcnow()
        if cached and (now - cached[1]) < self._ttl:
            return cached[0]

        ctx = TenantContext(tenant_id=tenant_id, tenant_slug=tenant_slug)
        ctx.load()
        self._cache[tenant_id] = (ctx, now)

        # Evict stale entries opportunistically
        stale = [
            tid for tid, (_, ts) in self._cache.items() if (now - ts) > self._ttl * 2
        ]
        for tid in stale:
            self._cache.pop(tid, None)

        return ctx

    def invalidate(self, tenant_id: str) -> None:
        self._cache.pop(tenant_id, None)


# Global singleton
_context_store = TenantContextStore(ttl_seconds=300)


def get_tenant_context(tenant_id: str, tenant_slug: str | None = None) -> TenantContext:
    return _context_store.get(tenant_id, tenant_slug)


def invalidate_tenant_context(tenant_id: str) -> None:
    _context_store.invalidate(tenant_id)
