import logging
import os
import sys
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import psycopg2
import psycopg2.pool
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ── AI layer ──────────────────────────────────────────────────────────────────
from config.settings import get_settings  # noqa: E402
from monitoring.budget_tracker import get_budget_tracker  # noqa: E402
from monitoring.notifications import get_notification_service  # noqa: E402
from monitoring.audit_logger import get_audit_logger  # noqa: E402

# Initialize singleton services
_budget = get_budget_tracker()
_notifications = get_notification_service()
_audit = get_audit_logger()

from endpoints.agent_chat import router as agent_chat_router  # noqa: E402
from endpoints.approvals import router as approvals_router  # noqa: E402
from endpoints.notifications import router as notifications_router  # noqa: E402
from endpoints.chat import router as chat_router  # noqa: E402
from endpoints.conversations import router as conversations_router  # noqa: E402
from endpoints.embeddings import router as embeddings_router  # noqa: E402
from endpoints.dashboard import router as dashboard_router  # noqa: E402
from endpoints.models import router as models_router  # noqa: E402
from endpoints.brain import router as brain_router  # noqa: E402
from middleware.cors import setup_cors  # noqa: E402
from middleware.logging import RequestLoggingMiddleware  # noqa: E402

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
load_dotenv("/var/www/zyra/.env", override=True)
load_dotenv("/var/www/zyra/.env.production", override=True)

# ── Settings ────────────────────────────────────────────────────────────────
settings = get_settings()
logger = logging.getLogger("zyra.ai-gateway")
logger.info(
    "AI Provider: %s | Model: %s | Ollama URL: %s",
    settings.active_provider,
    settings.OLLAMA_MODEL,
    settings.OLLAMA_URL,
)

# ── Database (BI layer) ───────────────────────────────────────────────────────
DATABASE_URL = (
    os.environ.get("ZYRA_DATABASE_URL")
    or os.environ.get("DATABASE_URL_PROD")
    or os.environ.get("DATABASE_URL")
    or "postgresql://zyra:zyra_secure_pass@localhost:5432/zyra_production?schema=public"
)

# ---------------------------------------------------------------------------
# Connection pool
# ---------------------------------------------------------------------------
_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def _init_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        # Strip non-libpq query parameters (e.g. "schema" used by Prisma)
        conninfo = _sanitize_dsn(DATABASE_URL)
        _pool = psycopg2.pool.ThreadedConnectionPool(1, 10, conninfo)
    return _pool


def _sanitize_dsn(dsn: str) -> str:
    if "?" not in dsn:
        return dsn
    base, _, query = dsn.partition("?")
    allowed = {p.split("=", 1)[0] for p in query.split("&") if "=" in p}
    # psycopg2 tolerates libpq query params as keywords; drop ones we pass explicitly.
    # "schema" is a Prisma-only param, not understood by libpq -> drop it.
    kept = []
    for p in query.split("&"):
        if "=" in p:
            key = p.split("=", 1)[0]
            if key not in ("schema",):
                kept.append(p)
        else:
            kept.append(p)
    if not kept:
        return base
    return base + "?" + "&".join(kept)


def _ensure_pool():
    if _pool is None:
        _init_pool()


@contextmanager
def get_conn():
    _ensure_pool()
    conn = _pool.getconn()
    try:
        yield conn
    finally:
        _pool.putconn(conn)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    if isinstance(val, Decimal):
        return float(val)
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _safe_int(val: Any, default: int = 0) -> int:
    if val is None:
        return default
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _query_one(sql: str, params: tuple = ()) -> dict | None:
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                cols = [d[0] for d in cur.description] if cur.description else []
                row = cur.fetchone()
                if row is None:
                    return None
                return dict(zip(cols, row))
    except Exception:
        return None


def _query_all(sql: str, params: tuple = ()) -> list[dict]:
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                cols = [d[0] for d in cur.description] if cur.description else []
                rows = cur.fetchall()
                return [dict(zip(cols, row)) for row in rows]
    except Exception:
        return []


def _execute_returning(sql: str, params: tuple) -> dict | None:
    """Execute a SQL statement with RETURNING clause and return the returned row."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                row = cur.fetchone()
                conn.commit()
                if row:
                    cols = [d[0] for d in cur.description]
                    return dict(zip(cols, row))
                return None
    except Exception as exc:
        logger.debug("_execute_returning failed: %s", exc)
        return None


def _resolve_tenant(tenant_id: str | None, tenant_slug: str | None) -> str | None:
    if tenant_id:
        return tenant_id
    if tenant_slug:
        row = _query_one('SELECT "id" FROM "tenants" WHERE "slug" = %s', (tenant_slug,))
        return row["id"] if row else None
    return None


def _date_range(range_input: dict | None) -> tuple[str, str]:
    now = datetime.utcnow()
    if range_input and "start" in range_input and "end" in range_input:
        return str(range_input["start"]), str(range_input["end"])
    # Default: last 30 days
    start = now - timedelta(days=30)
    return start.isoformat(), now.isoformat()


def _prev_date_range(start: str, end: str) -> tuple[str, str]:
    try:
        s = datetime.fromisoformat(start.replace("Z", "+00:00")).replace(tzinfo=None)
        e = datetime.fromisoformat(end.replace("Z", "+00:00")).replace(tzinfo=None)
        delta = e - s
        ps = s - delta
        pe = s
        return ps.isoformat(), pe.isoformat()
    except Exception:
        now = datetime.utcnow()
        return (now - timedelta(days=60)).isoformat(), (now - timedelta(days=30)).isoformat()


# ---------------------------------------------------------------------------
# SQL metric helpers
# ---------------------------------------------------------------------------

def _revenue_metrics(tenant_id: str, start: str, end: str) -> dict:
    row = _query_one(
        """
        SELECT
            COALESCE(SUM("total"), 0) AS revenue,
            COALESCE(SUM("subtotal"), 0) AS subtotal,
            COALESCE(SUM("tax"), 0) AS tax,
            COALESCE(SUM("shipping"), 0) AS shipping,
            COALESCE(SUM("discount"), 0) AS discount,
            COUNT(*) AS order_count
        FROM "orders"
        WHERE "tenantId" = %s AND "createdAt" >= %s AND "createdAt" < %s
        """,
        (tenant_id, start, end),
    )
    r = {k: _safe_float(v) for k, v in (row or {}).items()}
    r["order_count"] = _safe_int(row.get("order_count")) if row else 0
    r["aov"] = r["revenue"] / r["order_count"] if r["order_count"] else 0.0
    return r


def _prev_revenue_metrics(tenant_id: str, start: str, end: str) -> dict:
    ps, pe = _prev_date_range(start, end)
    return _revenue_metrics(tenant_id, ps, pe)


def _active_products(tenant_id: str) -> int:
    row = _query_one(
        'SELECT COUNT(*) AS cnt FROM "products" WHERE "tenantId" = %s AND "isActive" = true',
        (tenant_id,),
    )
    return _safe_int(row["cnt"]) if row else 0


def _total_customers(tenant_id: str, start: str, end: str) -> dict:
    total_row = _query_one(
        'SELECT COUNT(*) AS cnt FROM "customers" WHERE "tenantId" = %s',
        (tenant_id,),
    )
    new_row = _query_one(
        'SELECT COUNT(*) AS cnt FROM "customers" WHERE "tenantId" = %s AND "createdAt" >= %s AND "createdAt" < %s',
        (tenant_id, start, end),
    )
    return {
        "total": _safe_int(total_row["cnt"]) if total_row else 0,
        "new_in_period": _safe_int(new_row["cnt"]) if new_row else 0,
    }


def _commission_totals(tenant_id: str, start: str, end: str) -> dict:
    row = _query_one(
        """
        SELECT COALESCE(SUM("amount"), 0) AS total_commission,
               COALESCE(SUM("partnerShare"), 0) AS partner_total,
               COALESCE(SUM("headShare"), 0) AS head_total,
               COUNT(*) AS commission_count
        FROM "commissions"
        WHERE "tenantId" = %s AND "createdAt" >= %s AND "createdAt" < %s
        """,
        (tenant_id, start, end),
    )
    return {k: _safe_float(v) for k, v in (row or {}).items()} | {
        "commission_count": _safe_int(row.get("commission_count")) if row else 0
    }


def _estimated_margin(tenant_id: str, start: str, end: str) -> dict:
    row = _query_one(
        """
        SELECT
            COALESCE(SUM(oi."total"), 0) AS total_revenue,
            COALESCE(SUM(oi."quantity" * COALESCE(p."cost", 0)), 0) AS total_cost,
            COUNT(DISTINCT o."id") AS orders_with_cost
        FROM "order_items" oi
        JOIN "orders" o ON o."id" = oi."orderId"
        LEFT JOIN "products" p ON p."id" = oi."productId"
        WHERE o."tenantId" = %s AND o."createdAt" >= %s AND o."createdAt" < %s
        """,
        (tenant_id, start, end),
    )
    rev = _safe_float(row.get("total_revenue")) if row else 0.0
    cost = _safe_float(row.get("total_cost")) if row else 0.0
    gross = rev - cost
    margin_pct = (gross / rev * 100) if rev > 0 else 0.0
    return {"revenue": rev, "cogs": cost, "gross_profit": gross, "margin_pct": round(margin_pct, 1)}


def _customer_source_breakdown(tenant_id: str, start: str, end: str) -> list[dict]:
    return _query_all(
        """
        SELECT COALESCE(NULLIF("source", ''), 'unknown') AS source, COUNT(*) AS cnt
        FROM "customers"
        WHERE "tenantId" = %s AND "createdAt" >= %s AND "createdAt" < %s
        GROUP BY source ORDER BY cnt DESC
        """,
        (tenant_id, start, end),
    ) or []


def _customer_segment_breakdown(tenant_id: str) -> list[dict]:
    rows = _query_all(
        """
        SELECT COALESCE(NULLIF("segment", ''), 'unassigned') AS segment, COUNT(*) AS cnt
        FROM "customers"
        WHERE "tenantId" = %s
        GROUP BY COALESCE(NULLIF("segment", ''), 'unassigned') ORDER BY cnt DESC
        """,
        (tenant_id,),
    ) or []
    return [{"segment": str(r.get("segment") or "unassigned"), "cnt": _safe_int(r.get("cnt"))} for r in rows]


def _order_status_distribution(tenant_id: str, start: str, end: str) -> list[dict]:
    return _query_all(
        """
        SELECT "status", COUNT(*) AS cnt
        FROM "orders"
        WHERE "tenantId" = %s AND "createdAt" >= %s AND "createdAt" < %s
        GROUP BY "status" ORDER BY cnt DESC
        """,
        (tenant_id, start, end),
    ) or []


def _low_stock_products(tenant_id: str) -> list[dict]:
    return _query_all(
        """
        SELECT "name", "inventory", "price", "category"
        FROM "products"
        WHERE "tenantId" = %s AND "isActive" = true AND "inventory" <= 5
        ORDER BY "inventory" ASC
        LIMIT 20
        """,
        (tenant_id,),
    ) or []


def _top_products_by_revenue(tenant_id: str, start: str, end: str, limit: int = 5) -> list[dict]:
    return _query_all(
        """
        SELECT p."name", COALESCE(SUM(oi."total"), 0) AS revenue, COALESCE(SUM(oi."quantity"), 0) AS units
        FROM "order_items" oi
        JOIN "orders" o ON o."id" = oi."orderId"
        JOIN "products" p ON p."id" = oi."productId"
        WHERE o."tenantId" = %s AND o."createdAt" >= %s AND o."createdAt" < %s
        GROUP BY p."name" ORDER BY revenue DESC LIMIT %s
        """,
        (tenant_id, start, end, limit),
    ) or []


def _repeat_vs_new_customers(tenant_id: str, start: str, end: str) -> dict:
    row = _query_one(
        """
        SELECT
            COUNT(DISTINCT c."id") AS unique_buyers,
            COUNT(DISTINCT CASE WHEN sub.first_order < %s THEN c."id" END) AS repeat_buyers,
            COUNT(DISTINCT CASE WHEN sub.first_order >= %s THEN c."id" END) AS new_buyers
        FROM "customers" c
        JOIN "orders" o ON o."customerId" = c."id" AND o."tenantId" = %s AND o."createdAt" >= %s AND o."createdAt" < %s
        JOIN LATERAL (
            SELECT MIN(o2."createdAt") AS first_order
            FROM "orders" o2 WHERE o2."customerId" = c."id" AND o2."tenantId" = %s
        ) sub ON true
        """,
        (start, start, tenant_id, start, end, tenant_id),
    )
    if not row:
        return {"unique_buyers": 0, "repeat_buyers": 0, "new_buyers": 0}
    return {k: _safe_int(v) for k, v in row.items()}


def _growth_rate(current: float, previous: float) -> float:
    if previous <= 0:
        return 0.0 if current == 0 else 100.0
    return round(((current - previous) / previous) * 100, 1)


def _pending_commissions(tenant_id: str) -> int:
    row = _query_one(
        'SELECT COUNT(*) AS cnt FROM "commissions" WHERE "tenantId" = %s AND "status" = %s',
        (tenant_id, "PENDING"),
    )
    return _safe_int(row["cnt"]) if row else 0


def _out_of_stock_products(tenant_id: str) -> int:
    row = _query_one(
        'SELECT COUNT(*) AS cnt FROM "products" WHERE "tenantId" = %s AND "isActive" = true AND "inventory" <= 0',
        (tenant_id,),
    )
    return _safe_int(row["cnt"]) if row else 0


def _high_margin_products(tenant_id: str, start: str, end: str) -> list[dict]:
    return _query_all(
        """
        SELECT p."name",
               COALESCE(SUM(oi."total"), 0) AS revenue,
               COALESCE(SUM(oi."quantity" * COALESCE(p."cost", 0)), 0) AS cogs,
               CASE WHEN SUM(oi."total") > 0
                    THEN ROUND((SUM(oi."total") - SUM(oi."quantity" * COALESCE(p."cost", 0))) / SUM(oi."total") * 100, 1)
                    ELSE 0 END AS margin_pct
        FROM "order_items" oi
        JOIN "orders" o ON o."id" = oi."orderId"
        JOIN "products" p ON p."id" = oi."productId"
        WHERE o."tenantId" = %s AND o."createdAt" >= %s AND o."createdAt" < %s AND p."cost" > 0
        GROUP BY p."name" ORDER BY margin_pct DESC LIMIT 5
        """,
        (tenant_id, start, end),
    ) or []


def _avg_fulfillment_days(tenant_id: str, start: str, end: str) -> float | None:
    row = _query_one(
        """
        SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) / 86400) AS avg_days
        FROM "agent_runs"
        WHERE "tenantId" = %s AND "status" = 'completed'
          AND "startedAt" IS NOT NULL AND "completedAt" IS NOT NULL
          AND "createdAt" >= %s AND "createdAt" < %s
        """,
        (tenant_id, start, end),
    )
    if row and row.get("avg_days") is not None:
        return round(_safe_float(row["avg_days"]), 2)
    return None


def _commission_pending_amount(tenant_id: str) -> float:
    row = _query_one(
        'SELECT COALESCE(SUM("amount"), 0) AS total FROM "commissions" WHERE "tenantId" = %s AND "status" = %s',
        (tenant_id, "PENDING"),
    )
    return _safe_float(row["total"]) if row else 0.0


def _empty_segments(tenant_id: str) -> list[dict]:
    rows = _query_all(
        """
        SELECT COALESCE(NULLIF("segment", ''), 'unassigned') AS segment, COUNT(*) AS cnt
        FROM "customers"
        WHERE "tenantId" = %s
        GROUP BY COALESCE(NULLIF("segment", ''), 'unassigned')
        HAVING COUNT(*) <= 1
        ORDER BY cnt ASC
        LIMIT 5
        """,
        (tenant_id,),
    ) or []
    # Guard against any stray NULL segment values
    return [{"segment": str(r.get("segment") or "unassigned"), "cnt": _safe_int(r.get("cnt"))} for r in rows]


# ---------------------------------------------------------------------------
# Agent report generators
# ---------------------------------------------------------------------------

def _ceo_report(tenant_id: str, start: str, end: str) -> dict:
    rev = _revenue_metrics(tenant_id, start, end)
    prev_rev = _prev_revenue_metrics(tenant_id, start, end)
    products = _active_products(tenant_id)
    cust = _total_customers(tenant_id, start, end)
    comm = _commission_totals(tenant_id, start, end)
    revenue_growth = _growth_rate(rev["revenue"], prev_rev["revenue"])
    order_growth = _growth_rate(float(rev["order_count"]), float(prev_rev["order_count"]))

    metrics = {
        "revenue": round(rev["revenue"], 2),
        "orders": rev["order_count"],
        "aov": round(rev["aov"], 2),
        "active_products": products,
        "total_customers": cust["total"],
        "new_customers": cust["new_in_period"],
        "total_commissions": round(comm["total_commission"], 2),
        "revenue_growth_pct": revenue_growth,
        "order_growth_pct": order_growth,
    }

    summary_parts = []
    summary_parts.append(f"Total revenue for the period is ${rev['revenue']:,.2f} across {rev['order_count']} orders with an average order value of ${rev['aov']:,.2f}.")
    if revenue_growth > 0:
        summary_parts.append(f"Revenue is up {revenue_growth}% compared to the previous period.")
    elif revenue_growth < 0:
        summary_parts.append(f"Revenue declined {abs(revenue_growth)}% versus the prior period.")
    summary_parts.append(f"There are {products} active products, {cust['total']} total customers ({cust['new_in_period']} new this period), and ${comm['total_commission']:,.2f} in commissions generated.")

    recs = []
    if rev["aov"] < 50:
        recs.append("Average order value is low. Consider implementing upsell or bundle strategies.")
    if revenue_growth < 0:
        recs.append("Revenue is declining. Review pricing strategy and marketing spend allocation.")
    if cust["new_in_period"] < 5:
        recs.append("New customer acquisition is slow. Increase marketing efforts or run promotional campaigns.")
    if products < 10:
        recs.append("Active product catalog is small. Expand the product range to increase revenue potential.")
    if not recs:
        recs.append("Business is performing steadily. Continue monitoring key metrics for sustained growth.")

    return {
        "title": "CEO Business Overview",
        "summary": " ".join(summary_parts),
        "metrics": metrics,
        "recommendations": recs,
        "generated_at": datetime.utcnow().isoformat(),
    }


def _cfo_report(tenant_id: str, start: str, end: str) -> dict:
    rev = _revenue_metrics(tenant_id, start, end)
    margin = _estimated_margin(tenant_id, start, end)
    comm = _commission_totals(tenant_id, start, end)
    pending_comm = _commission_pending_amount(tenant_id)

    metrics = {
        "gross_revenue": round(rev["revenue"], 2),
        "subtotal": round(rev["subtotal"], 2),
        "tax": round(rev["tax"], 2),
        "shipping": round(rev["shipping"], 2),
        "discount": round(rev["discount"], 2),
        "net_revenue": round(rev["subtotal"], 2),
        "estimated_cogs": round(margin["cogs"], 2),
        "gross_profit": round(margin["gross_profit"], 2),
        "gross_margin_pct": margin["margin_pct"],
        "commission_liability": round(comm["total_commission"], 2),
        "pending_commissions": round(pending_comm, 2),
        "net_cash_flow_proxy": round(rev["revenue"] - margin["cogs"] - comm["total_commission"], 2),
    }

    summary_parts = []
    summary_parts.append(f"Gross revenue is ${rev['revenue']:,.2f} with subtotal ${rev['subtotal']:,.2f}, tax ${rev['tax']:,.2f}, shipping ${rev['shipping']:,.2f}, and discounts ${rev['discount']:,.2f}.")
    summary_parts.append(f"Estimated gross profit is ${margin['gross_profit']:,.2f} after COGS of ${margin['cogs']:,.2f}, yielding a {margin['margin_pct']}% margin.")
    summary_parts.append(f"Commission liability is ${comm['total_commission']:,.2f} with ${pending_comm:,.2f} pending payout.")

    recs = []
    if margin["margin_pct"] < 30:
        recs.append(f"Gross margin is {margin['margin_pct']}%, which is below healthy thresholds. Negotiate better supplier costs or increase prices.")
    if pending_comm > 1000:
        recs.append(f"Pending commissions total ${pending_comm:,.2f}. Ensure timely payouts to maintain partner trust.")
    if rev["discount"] > rev["revenue"] * 0.2:
        recs.append("Discounts exceed 20% of revenue. Review discount policies to protect margins.")
    if not recs:
        recs.append("Financial metrics look healthy. Continue monitoring margins and commission obligations.")

    return {
        "title": "CFO Financial Analysis",
        "summary": " ".join(summary_parts),
        "metrics": metrics,
        "recommendations": recs,
        "generated_at": datetime.utcnow().isoformat(),
    }


def _cmo_report(tenant_id: str, start: str, end: str) -> dict:
    cust = _total_customers(tenant_id, start, end)
    sources = _customer_source_breakdown(tenant_id, start, end)
    segments = _customer_segment_breakdown(tenant_id)
    rev = _revenue_metrics(tenant_id, start, end)
    repeat = _repeat_vs_new_customers(tenant_id, start, end)
    top_products = _top_products_by_revenue(tenant_id, start, end, 5)

    source_map = {s["source"]: _safe_int(s["cnt"]) for s in sources}
    seg_map = {s["segment"]: _safe_int(s["cnt"]) for s in segments}
    repeat_ratio = round(repeat["repeat_buyers"] / repeat["unique_buyers"] * 100, 1) if repeat["unique_buyers"] else 0.0

    metrics = {
        "new_customers": cust["new_in_period"],
        "total_customers": cust["total"],
        "aov": round(rev["aov"], 2),
        "customer_sources": source_map,
        "customer_segments": seg_map,
        "repeat_buyer_ratio_pct": repeat_ratio,
        "repeat_buyers": repeat["repeat_buyers"],
        "new_buyers": repeat["new_buyers"],
        "top_products": [{"name": p["name"], "revenue": _safe_float(p["revenue"]), "units": _safe_int(p["units"])} for p in top_products],
    }

    summary_parts = []
    summary_parts.append(f"{cust['new_in_period']} new customers were acquired this period out of {cust['total']} total.")
    summary_parts.append(f"Repeat purchase ratio is {repeat_ratio}% with {repeat['repeat_buyers']} repeat and {repeat['new_buyers']} new buyers.")
    if top_products:
        summary_parts.append(f"Top product by revenue is {top_products[0]['name']} at ${_safe_float(top_products[0]['revenue']):,.2f}.")

    recs = []
    if repeat_ratio < 20:
        recs.append("Repeat purchase rate is below 20%. Invest in retention campaigns and email marketing.")
    if cust["new_in_period"] < 5:
        recs.append("Low new customer acquisition. Run targeted ads or referral programs.")
    if len(source_map) == 1:
        recs.append("Customer acquisition is concentrated in one channel. Diversify marketing channels.")
    if not recs:
        recs.append("Marketing performance is solid. Continue optimizing acquisition and retention strategies.")

    return {
        "title": "CMO Marketing Intelligence",
        "summary": " ".join(summary_parts),
        "metrics": metrics,
        "recommendations": recs,
        "generated_at": datetime.utcnow().isoformat(),
    }


def _coo_report(tenant_id: str, start: str, end: str) -> dict:
    statuses = _order_status_distribution(tenant_id, start, end)
    low_stock = _low_stock_products(tenant_id)
    avg_days = _avg_fulfillment_days(tenant_id, start, end)
    out_of_stock = _out_of_stock_products(tenant_id)

    status_map = {s["status"]: _safe_int(s["cnt"]) for s in statuses}
    total_orders = sum(status_map.values())

    pending_count = sum(v for k, v in status_map.items() if k in ("PENDING", "PROCESSING"))
    fulfilled_count = sum(v for k, v in status_map.items() if k in ("DELIVERED", "COMPLETED"))
    fallout_rate = round(pending_count / total_orders * 100, 1) if total_orders else 0.0

    metrics = {
        "order_status_distribution": status_map,
        "total_orders": total_orders,
        "pending_or_processing": pending_count,
        "fulfilled": fulfilled_count,
        "fallout_rate_pct": fallout_rate,
        "low_stock_products": [{"name": p["name"], "inventory": _safe_int(p["inventory"]), "price": _safe_float(p["price"])} for p in low_stock],
        "out_of_stock_count": out_of_stock,
        "avg_fulfillment_days": avg_days,
    }

    summary_parts = []
    summary_parts.append(f"{total_orders} orders were placed this period. {fulfilled_count} have been fulfilled and {pending_count} are pending or processing.")
    if avg_days is not None:
        summary_parts.append(f"Average fulfillment time is {avg_days} days.")
    summary_parts.append(f"{len(low_stock)} products are low on stock (5 or fewer units) and {out_of_stock} are completely out of stock.")

    recs = []
    if fallout_rate > 20:
        recs.append(f"Fallout rate is {fallout_rate}%. Investigate bottlenecks in order processing and fulfillment.")
    if len(low_stock) > 0:
        low_names = ", ".join(p["name"] for p in low_stock[:3])
        recs.append(f"Reorder low-stock items urgently: {low_names}.")
    if out_of_stock > 0:
        recs.append(f"{out_of_stock} products are out of stock and losing potential revenue. Restock immediately.")
    if not recs:
        recs.append("Operations are running smoothly. Maintain current fulfillment processes.")

    return {
        "title": "COO Operations Report",
        "summary": " ".join(summary_parts),
        "metrics": metrics,
        "recommendations": recs,
        "generated_at": datetime.utcnow().isoformat(),
    }


def _growth_report(tenant_id: str, start: str, end: str) -> dict:
    rev = _revenue_metrics(tenant_id, start, end)
    prev_rev = _prev_revenue_metrics(tenant_id, start, end)
    cust = _total_customers(tenant_id, start, end)
    top_products = _top_products_by_revenue(tenant_id, start, end, 5)
    segments = _customer_segment_breakdown(tenant_id)

    revenue_growth = _growth_rate(rev["revenue"], prev_rev["revenue"])
    order_growth = _growth_rate(float(rev["order_count"]), float(prev_rev["order_count"]))
    customer_growth = _growth_rate(float(cust["new_in_period"]), 0.0)

    # LTV estimate: revenue per unique customer over the period
    repeat = _repeat_vs_new_customers(tenant_id, start, end)
    ltv_per_segment = {}
    for seg in segments:
        ltv_per_segment[seg["segment"]] = round(
            rev["revenue"] / max(repeat["unique_buyers"], 1) * 12, 2
        )  # annualized

    metrics = {
        "revenue_growth_pct": revenue_growth,
        "order_growth_pct": order_growth,
        "revenue_current": round(rev["revenue"], 2),
        "revenue_previous": round(prev_rev["revenue"], 2),
        "aov": round(rev["aov"], 2),
        "new_customers": cust["new_in_period"],
        "total_customers": cust["total"],
        "top_sellers": [{"name": p["name"], "revenue": _safe_float(p["revenue"]), "units": _safe_int(p["units"])} for p in top_products],
        "ltv_estimates_by_segment": ltv_per_segment,
    }

    summary_parts = []
    summary_parts.append(f"Revenue grew {revenue_growth}% from ${prev_rev['revenue']:,.2f} to ${rev['revenue']:,.2f}.")
    if revenue_growth > 0:
        summary_parts.append(f"Order volume grew {order_growth}% with {rev['order_count']} orders this period.")
    elif revenue_growth < 0:
        summary_parts.append(f"Both revenue and order volume declined, indicating a downturn.")
    summary_parts.append(f"Estimated annualized customer LTV ranges across segments with {cust['total']} total customers.")

    recs = []
    if revenue_growth > 10:
        recs.append("Strong growth trajectory. Scale marketing spend and prepare infrastructure for increased demand.")
    elif revenue_growth < -5:
        recs.append("Revenue is contracting. Conduct a market analysis and adjust pricing or product mix.")
    if cust["new_in_period"] < 3:
        recs.append("New customer growth is flat. Explore new acquisition channels or partnerships.")
    if rev["aov"] < 40:
        recs.append("Low average order value. Test cross-sell and upsell strategies to increase basket size.")
    if not recs:
        recs.append("Growth is stable. Focus on incremental improvements in conversion and retention.")

    return {
        "title": "Growth Analysis",
        "summary": " ".join(summary_parts),
        "metrics": metrics,
        "recommendations": recs,
        "generated_at": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------

def _generate_insights(tenant_id: str) -> list[dict]:
    now = datetime.utcnow()
    start_30 = (now - timedelta(days=30)).isoformat()
    start_60 = (now - timedelta(days=60)).isoformat()
    end_now = now.isoformat()
    insights = []

    # Revenue trend
    rev = _revenue_metrics(tenant_id, start_30, end_now)
    prev = _revenue_metrics(tenant_id, start_60, start_30)
    rg = _growth_rate(rev["revenue"], prev["revenue"])
    if rg < -10:
        insights.append({
            "type": "alert",
            "priority": "high",
            "title": "Revenue decline detected",
            "detail": f"Revenue dropped {abs(rg)}% over the last 30 days versus the prior 30 days (${prev['revenue']:,.2f} to ${rev['revenue']:,.2f}).",
            "action": "Review pricing, marketing spend, and product availability immediately.",
        })
    elif rg > 10:
        insights.append({
            "type": "opportunity",
            "priority": "medium",
            "title": "Revenue growth trending upward",
            "detail": f"Revenue grew {rg}% over the last 30 days. Current period revenue is ${rev['revenue']:,.2f}.",
            "action": "Scale winning campaigns and consider expanding product offerings.",
        })

    # Low stock
    low = _low_stock_products(tenant_id)
    oos = _out_of_stock_products(tenant_id)
    if oos > 0:
        insights.append({
            "type": "alert",
            "priority": "high",
            "title": f"{oos} product(s) are out of stock",
            "detail": f"There are {oos} products with zero inventory, potentially losing sales.",
            "action": "Restock out-of-stock items as a priority to prevent revenue loss.",
        })
    elif len(low) > 0:
        insights.append({
            "type": "alert",
            "priority": "medium",
            "title": f"{len(low)} product(s) running low on stock",
            "detail": f"Products with 5 or fewer units: {', '.join(p['name'] for p in low[:3])}.",
            "action": "Place reorders for low-stock items before they sell out.",
        })

    # High margin products
    high_margin = _high_margin_products(tenant_id, start_30, end_now)
    if high_margin and len(high_margin) > 0:
        hm = high_margin[0]
        insights.append({
            "type": "opportunity",
            "priority": "medium",
            "title": "High margin product identified",
            "detail": f"{hm['name']} has a {hm['margin_pct']}% gross margin and generated ${_safe_float(hm['revenue']):,.2f} in revenue.",
            "action": "Promote this product more heavily in marketing campaigns to maximize profit.",
        })

    # Repeat customer opportunity
    repeat = _repeat_vs_new_customers(tenant_id, start_30, end_now)
    if repeat["unique_buyers"] > 0 and repeat["repeat_buyers"] / repeat["unique_buyers"] < 0.2:
        insights.append({
            "type": "opportunity",
            "priority": "high",
            "title": "Low customer retention rate",
            "detail": f"Only {repeat['repeat_buyers']} of {repeat['unique_buyers']} buyers ({round(repeat['repeat_buyers'] / repeat['unique_buyers'] * 100, 1)}%) made repeat purchases.",
            "action": "Launch a retention campaign with personalized offers for recent one-time buyers.",
        })

    # Pending commissions
    pending_comm = _commission_pending_amount(tenant_id)
    if pending_comm > 0:
        insights.append({
            "type": "info",
            "priority": "low" if pending_comm < 500 else "high",
            "title": f"${pending_comm:,.2f} in pending commissions",
            "detail": f"There are {sum(1 for _ in [])} pending commissions awaiting payout resolution.",
            "action": "Review and process pending commission payments to maintain partner relationships.",
        })

    # Order fallout
    statuses = _order_status_distribution(tenant_id, start_30, end_now)
    status_map = {s["status"]: _safe_int(s["cnt"]) for s in statuses}
    total = sum(status_map.values())
    problematic = sum(v for k, v in status_map.items() if k in ("CANCELLED", "REFUNDED"))
    if total > 0 and problematic / total > 0.1:
        insights.append({
            "type": "alert",
            "priority": "high",
            "title": "High order fallout rate",
            "detail": f"{problematic} of {total} orders ({round(problematic / total * 100, 1)}%) are cancelled or refunded.",
            "action": "Investigate root causes for cancellations and refunds. Improve product descriptions and quality.",
        })

    # Empty segments
    empty_segs = _empty_segments(tenant_id)
    if empty_segs:
        insights.append({
            "type": "info",
            "priority": "low",
            "title": "Customer segments with minimal data",
            "detail": f"Segments with 1 or fewer customers: {', '.join(s['segment'] for s in empty_segs[:3])}.",
            "action": "Collect more customer data to enable targeted segmentation and personalization.",
        })

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    insights.sort(key=lambda x: priority_order.get(x["priority"], 3))

    return insights[:6]


# ---------------------------------------------------------------------------
# Collaborate — deterministic Q&A
# ---------------------------------------------------------------------------

def _collaborate_answer(tenant_id: str, question: str) -> str:
    q = question.lower()
    now = datetime.utcnow()
    start = (now - timedelta(days=30)).isoformat()
    end = now.isoformat()

    if any(kw in q for kw in ("revenue", "sales", "money", "income")):
        rev = _revenue_metrics(tenant_id, start, end)
        prev = _prev_revenue_metrics(tenant_id, start, end)
        rg = _growth_rate(rev["revenue"], prev["revenue"])
        return (
            f"Revenue over the last 30 days is ${rev['revenue']:,.2f} across "
            f"{rev['order_count']} orders with an average order value of ${rev['aov']:,.2f}. "
            f"That is a {rg}% change versus the previous 30-day period."
        )

    if any(kw in q for kw in ("orders", "order")):
        rev = _revenue_metrics(tenant_id, start, end)
        statuses = _order_status_distribution(tenant_id, start, end)
        status_str = ", ".join(f"{s['status']}: {s['cnt']}" for s in statuses)
        return (
            f"There have been {rev['order_count']} orders totaling ${rev['revenue']:,.2f}. "
            f"Status breakdown: {status_str}."
        )

    if any(kw in q for kw in ("profit", "margin", "cost")):
        m = _estimated_margin(tenant_id, start, end)
        return (
            f"Estimated gross profit is ${m['gross_profit']:,.2f} (revenue ${m['revenue']:,.2f} minus COGS ${m['cogs']:,.2f}), "
            f"yielding a {m['margin_pct']}% gross margin."
        )

    if any(kw in q for kw in ("customers", "users", "buyers")):
        cust = _total_customers(tenant_id, start, end)
        sources = _customer_source_breakdown(tenant_id, start, end)
        src_str = ", ".join(f"{s['source']}: {s['cnt']}" for s in sources)
        return (
            f"You have {cust['total']} total customers, with {cust['new_in_period']} new in the last 30 days. "
            f"Customer sources: {src_str}."
        )

    if any(kw in q for kw in ("stock", "inventory", "products")):
        low = _low_stock_products(tenant_id)
        oos = _out_of_stock_products(tenant_id)
        total_products = _active_products(tenant_id)
        if low:
            low_str = ", ".join(f"{p['name']} ({p['inventory']})" for p in low[:5])
        else:
            low_str = "none"
        return (
            f"There are {total_products} active products. {len(low)} are low on stock (<=5 units): {low_str}. "
            f"{oos} products are completely out of stock."
        )

    if any(kw in q for kw in ("commission", "partner")):
        comm = _commission_totals(tenant_id, start, end)
        pending = _commission_pending_amount(tenant_id)
        return (
            f"Commissions this period total ${comm['total_commission']:,.2f} "
            f"(partner share: ${comm['partner_total']:,.2f}, head share: ${comm['head_total']:,.2f}). "
            f"${pending:,.2f} is pending payout."
        )

    if any(kw in q for kw in ("growth", "trend", "performance")):
        rev = _revenue_metrics(tenant_id, start, end)
        prev = _prev_revenue_metrics(tenant_id, start, end)
        rg = _growth_rate(rev["revenue"], prev["revenue"])
        cust = _total_customers(tenant_id, start, end)
        return (
            f"Revenue growth is {rg}% over the last 30 days "
            f"(${prev['revenue']:,.2f} to ${rev['revenue']:,.2f}). "
            f"New customers in this period: {cust['new_in_period']}."
        )

    if any(kw in q for kw in ("product", "catalog", "item")):
        top = _top_products_by_revenue(tenant_id, start, end, 5)
        total_products = _active_products(tenant_id)
        if top:
            top_str = ", ".join(f"{p['name']} (${_safe_float(p['revenue']):,.2f})" for p in top)
        else:
            top_str = "no sales data available"
        return (
            f"You have {total_products} active products. Top sellers this period: {top_str}."
        )

    # Fallback — general summary
    rev = _revenue_metrics(tenant_id, start, end)
    cust = _total_customers(tenant_id, start, end)
    return (
        f"In the last 30 days: ${rev['revenue']:,.2f} revenue across {rev['order_count']} orders, "
        f"{cust['total']} total customers ({cust['new_in_period']} new), "
        f"average order value ${rev['aov']:,.2f}."
    )


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ZYRA AI Gateway",
    description="AI-powered business intelligence for ZYRA — Ollama + OpenAI-compatible + ZYRA Agents",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middleware
app.add_middleware(RequestLoggingMiddleware)
setup_cors(app)

# AI layer routes
app.include_router(chat_router, prefix="/v1", tags=["AI Completions"])
app.include_router(embeddings_router, prefix="/v1", tags=["AI Embeddings"])
app.include_router(models_router, prefix="/v1", tags=["AI Models"])
app.include_router(agent_chat_router, tags=["ZYRA Agents"])
app.include_router(conversations_router, tags=["Conversations"])
app.include_router(approvals_router, tags=["Approvals"])
app.include_router(notifications_router, tags=["Notifications"])
app.include_router(brain_router, tags=["Business Brain"])
app.include_router(dashboard_router, tags=["Dashboard"])


class AgentRunRequest(BaseModel):
    agent_type: str
    input: dict[str, Any]
    context: dict[str, Any] | None = None


class AgentRunResponse(BaseModel):
    run_id: str
    agent_type: str
    status: str
    output: dict[str, Any]


class InsightsRequest(BaseModel):
    tenantId: str | None = None
    tenantSlug: str | None = None


class InsightsResponse(BaseModel):
    insights: list[dict[str, Any]]
    generated_at: str


class CollaborateRequest(BaseModel):
    tenantId: str | None = None
    tenantSlug: str | None = None
    question: str


class CollaborateResponse(BaseModel):
    answer: str
    generated_at: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "zyra-ai-gateway",
        "version": "2.0.0",
        "ai_provider": settings.active_provider,
        "ollama_url": settings.OLLAMA_URL,
    }


@app.get("/")
def root():
    return {
        "name": "ZYRA AI Gateway",
        "version": "2.0.0",
        "ai_provider": settings.active_provider,
        "endpoints": {
            "ai_chat": "/v1/chat/completions",
            "ai_embeddings": "/v1/embeddings",
            "ai_models": "/v1/models",
            "zyra_agent_chat": "/v1/agents/chat",
            "bi_agent_run": "/v1/agents/run",
            "bi_insights": "/v1/agents/insights",
            "bi_collaborate": "/v1/agents/collaborate",
            "brain_memories": "/brain/memories",
            "brain_decisions": "/brain/decisions",
            "brain_events": "/brain/events",
            "brain_agents": "/brain/agents",
            "approvals": "/approvals",
            "dashboard_health": "/dashboard/health-score",
            "dashboard_kpis": "/dashboard/kpis",
            "conversations": "/conversations",
            "health": "/health",
            "docs": "/docs",
        },
    }


@app.post("/v1/agents/run", response_model=AgentRunResponse)
def run_agent(req: AgentRunRequest):
    run_id = uuid.uuid4().hex
    agent_type = req.agent_type.lower()
    tenant_id = req.input.get("tenantId")
    tenant_slug = req.input.get("tenantSlug")
    date_range = req.input.get("dateRange")

    resolved_tenant = _resolve_tenant(tenant_id, tenant_slug)
    if not resolved_tenant:
        raise HTTPException(status_code=400, detail="Could not resolve tenant. Provide a valid tenantId or tenantSlug.")

    start, end = _date_range(date_range)

    generators = {
        "ceo": _ceo_report,
        "cfo": _cfo_report,
        "cmo": _cmo_report,
        "coo": _coo_report,
        "growth": _growth_report,
    }

    generator = generators.get(agent_type)
    if not generator:
        raise HTTPException(status_code=400, detail=f"Unknown agent_type '{agent_type}'. Valid types: {list(generators.keys())}")

    try:
        output = generator(resolved_tenant, start, end)
    except Exception as exc:
        output = {
            "title": f"{agent_type.upper()} Report",
            "summary": f"An error occurred while generating this report: {str(exc)}",
            "metrics": {},
            "recommendations": ["Unable to generate recommendations due to a data processing error."],
            "generated_at": datetime.utcnow().isoformat(),
        }

    return AgentRunResponse(
        run_id=run_id,
        agent_type=agent_type,
        status="completed",
        output=output,
    )


@app.post("/v1/agents/insights", response_model=InsightsResponse)
def get_insights(req: InsightsRequest):
    resolved_tenant = _resolve_tenant(req.tenantId, req.tenantSlug)
    if not resolved_tenant:
        raise HTTPException(status_code=400, detail="Could not resolve tenant. Provide a valid tenantId or tenantSlug.")

    try:
        insights = _generate_insights(resolved_tenant)
    except Exception as exc:
        insights = [{"type": "info", "priority": "low", "title": "Insight generation error", "detail": str(exc), "action": "Check service logs."}]

    return InsightsResponse(
        insights=insights,
        generated_at=datetime.utcnow().isoformat(),
    )


@app.post("/v1/agents/collaborate", response_model=CollaborateResponse)
def collaborate(req: CollaborateRequest):
    resolved_tenant = _resolve_tenant(req.tenantId, req.tenantSlug)
    if not resolved_tenant:
        raise HTTPException(status_code=400, detail="Could not resolve tenant. Provide a valid tenantId or tenantSlug.")

    try:
        answer = _collaborate_answer(resolved_tenant, req.question)
    except Exception as exc:
        answer = f"An error occurred while processing your question: {str(exc)}. Please try again."

    return CollaborateResponse(
        answer=answer,
        generated_at=datetime.utcnow().isoformat(),
    )
