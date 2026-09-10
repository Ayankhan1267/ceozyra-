"""
ZYRA AI Gateway — Founder Dashboard endpoints
Health score, KPIs, and business overview.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException

from main import (
    _commission_pending_amount,
    _customer_segment_breakdown,
    _customer_source_breakdown,
    _estimated_margin,
    _growth_rate,
    _low_stock_products,
    _order_status_distribution,
    _out_of_stock_products,
    _prev_revenue_metrics,
    _prev_date_range,
    _query_one,
    _revenue_metrics,
    _repeat_vs_new_customers,
    _resolve_tenant,
    _safe_float,
    _safe_int,
    _total_customers,
    _top_products_by_revenue,
)

logger = logging.getLogger("zyra.endpoints.dashboard")
router = APIRouter()


@router.get("/dashboard/health-score/{tenant_id:path}")
def health_score(tenant_id: str):
    """Compute overall business health score (0-100) with per-factor breakdown."""
    tenant_id = _resolve_tenant(tenant_id, None) or tenant_id
    now = datetime.utcnow()
    start = (now - timedelta(days=30)).isoformat()
    end = now.isoformat()

    prev_start, prev_end = _prev_date_range(start, end)

    factors = []
    total_score = 0.0
    total_weight = 0.0

    # Factor 1: Revenue growth (weight: 30%)
    try:
        rev = _revenue_metrics(tenant_id, start, end)
        prev_rev = _prev_revenue_metrics(tenant_id, start, end)
        rg = _growth_rate(rev["revenue"], prev_rev["revenue"])
        # Score: 100 if +20%+, 50 if 0%, 0 if -20%+
        rev_score = max(0, min(100, 50 + rg * 2.5))
        status = "good" if rg >= 5 else ("warning" if rg >= -10 else "critical")
        factors.append({"name": "Revenue Growth", "score": round(rev_score, 1), "weight": 0.30, "status": status})
        total_score += rev_score * 0.30
        total_weight += 0.30
    except Exception as exc:
        logger.warning("revenue factor error: %s", exc)

    # Factor 2: Margin health (weight: 25%)
    try:
        margin = _estimated_margin(tenant_id, start, end)
        margin_pct = margin.get("margin_pct", 0)
        # Score: 100 if >50%, 50 if 30%, 0 if <10%
        margin_score = max(0, min(100, (margin_pct - 10) * 2.5))
        status = "good" if margin_pct >= 40 else ("warning" if margin_pct >= 25 else "critical")
        factors.append({"name": "Margin Health", "score": round(margin_score, 1), "weight": 0.25, "status": status})
        total_score += margin_score * 0.25
        total_weight += 0.25
    except Exception as exc:
        logger.warning("margin factor error: %s", exc)

    # Factor 3: Customer retention (weight: 20%)
    try:
        repeat = _repeat_vs_new_customers(tenant_id, start, end)
        if repeat["unique_buyers"] > 0:
            retention = repeat["repeat_buyers"] / repeat["unique_buyers"] * 100
        else:
            retention = 0
        ret_score = max(0, min(100, retention * 2))
        status = "good" if retention >= 30 else ("warning" if retention >= 15 else "critical")
        factors.append({"name": "Customer Retention", "score": round(ret_score, 1), "weight": 0.20, "status": status})
        total_score += ret_score * 0.20
        total_weight += 0.20
    except Exception as exc:
        logger.warning("retention factor error: %s", exc)

    # Factor 4: Inventory health (weight: 15%)
    try:
        oos = _out_of_stock_products(tenant_id)
        low = _low_stock_products(tenant_id)
        active = _safe_int(_query_one(
            'SELECT COUNT(*) AS cnt FROM "products" WHERE "tenantId" = %s AND "isActive" = true',
            (tenant_id,),
        ).get("cnt") if _query_one('SELECT COUNT(*) AS cnt FROM "products" WHERE "tenantId" = %s AND "isActive" = true', (tenant_id,)) else {"cnt": 0})

        if active > 0:
            health_pct = max(0, 100 - (oos * 30 + len(low) * 5))
        else:
            health_pct = 50
        inv_score = max(0, min(100, health_pct))
        status = "good" if oos == 0 and len(low) <= 2 else ("warning" if oos <= 2 else "critical")
        factors.append({"name": "Inventory Health", "score": round(inv_score, 1), "weight": 0.15, "status": status})
        total_score += inv_score * 0.15
        total_weight += 0.15
    except Exception as exc:
        logger.warning("inventory factor error: %s", exc)

    # Factor 5: Commission health (weight: 10%)
    try:
        pending = _commission_pending_amount(tenant_id)
        pending_count = _safe_int(_query_one(
            'SELECT COUNT(*) AS cnt FROM "commissions" WHERE "tenantId" = %s AND "status" = %s',
            (tenant_id, "PENDING"),
        ).get("cnt") if _query_one('SELECT COUNT(*) AS cnt FROM "commissions" WHERE "tenantId" = %s AND "status" = %s', (tenant_id, "PENDING")) else {"cnt": 0})

        comm_score = max(0, min(100, 100 - pending_count * 10))
        status = "good" if pending_count == 0 else ("warning" if pending_count <= 3 else "critical")
        factors.append({"name": "Commission Health", "score": round(comm_score, 1), "weight": 0.10, "status": status})
        total_score += comm_score * 0.10
        total_weight += 0.10
    except Exception as exc:
        logger.warning("commission factor error: %s", exc)

    overall = round(total_score / total_weight, 1) if total_weight > 0 else 0
    grade = "A" if overall >= 85 else "B" if overall >= 70 else "C" if overall >= 55 else "D" if overall >= 40 else "F"

    return {
        "overall_score": overall,
        "grade": grade,
        "factors": factors,
        "generated_at": now.isoformat(),
    }


@router.get("/dashboard/kpis/{tenant_id:path}")
def kpis(tenant_id: str):
    """Return key performance indicators with period comparisons."""
    tenant_id = _resolve_tenant(tenant_id, None) or tenant_id
    now = datetime.utcnow()
    start = (now - timedelta(days=30)).isoformat()
    end = now.isoformat()

    prev_start, prev_end = _prev_date_range(start, end)

    # Revenue
    rev = _revenue_metrics(tenant_id, start, end)
    prev_rev = _revenue_metrics(tenant_id, prev_start, prev_end)

    # Customers
    cust = _total_customers(tenant_id, start, end)
    repeat = _repeat_vs_new_customers(tenant_id, start, end)

    # Margin
    margin = _estimated_margin(tenant_id, start, end)

    # Commission
    pending_comm = _commission_pending_amount(tenant_id)

    # Low stock
    low_stock = _low_stock_products(tenant_id)

    # Retention
    ret_pct = round(repeat["repeat_buyers"] / repeat["unique_buyers"] * 100, 1) if repeat["unique_buyers"] else 0

    kpi_list = [
        {
            "key": "revenue",
            "label": "Revenue (30d)",
            "value": round(rev["revenue"], 2),
            "previous": round(prev_rev["revenue"], 2),
            "change_pct": _growth_rate(rev["revenue"], prev_rev["revenue"]),
            "format": "currency",
        },
        {
            "key": "orders",
            "label": "Orders (30d)",
            "value": rev["order_count"],
            "previous": prev_rev["order_count"],
            "change_pct": _growth_rate(float(rev["order_count"]), float(prev_rev["order_count"])),
            "format": "number",
        },
        {
            "key": "aov",
            "label": "Avg Order Value",
            "value": round(rev["aov"], 2),
            "previous": round(prev_rev["aov"], 2),
            "change_pct": _growth_rate(rev["aov"], prev_rev["aov"]),
            "format": "currency",
        },
        {
            "key": "new_customers",
            "label": "New Customers (30d)",
            "value": cust["new_in_period"],
            "previous": 0,
            "change_pct": 0,
            "format": "number",
        },
        {
            "key": "repeat_rate",
            "label": "Repeat Buyer Rate",
            "value": ret_pct,
            "previous": 0,
            "change_pct": 0,
            "format": "percent",
        },
        {
            "key": "gross_margin",
            "label": "Gross Margin",
            "value": margin["margin_pct"],
            "previous": 0,
            "change_pct": 0,
            "format": "percent",
        },
        {
            "key": "pending_commissions",
            "label": "Pending Commissions",
            "value": round(pending_comm, 2),
            "previous": 0,
            "change_pct": 0,
            "format": "currency",
        },
        {
            "key": "low_stock_count",
            "label": "Low Stock Products",
            "value": len(low_stock),
            "previous": 0,
            "change_pct": 0,
            "format": "number",
        },
    ]

    return {"kpis": kpi_list, "generated_at": now.isoformat()}
