"""
ZYRA AI Gateway — Token Budget Tracker
Tracks token usage per tenant, per agent run, and enforces budget limits.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("zyra.monitoring.budget")


@dataclass
class TokenUsage:
    """Single token usage record."""
    run_id: str
    tenant_id: str
    agent_role: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    cached: bool = False
    created_at: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        if not self.total_tokens:
            self.total_tokens = self.prompt_tokens + self.completion_tokens


@dataclass
class BudgetStatus:
    """Current budget status for a tenant."""
    daily_tokens_used: int = 0
    daily_limit: int = 0
    monthly_tokens_used: int = 0
    monthly_limit: int = 0
    remaining_daily: int = 0
    remaining_monthly: int = 0
    percentage_used: float = 0.0
    is_over_budget: bool = False
    is_warning: bool = False


class TokenBudgetTracker:
    """
    Tracks and enforces token budgets for AI usage.
    Stores usage records and provides budget status checks.
    """

    def __init__(self):
        self._records: list[TokenUsage] = []
        self._daily_limits: dict[str, int] = {}      # tenant_id -> limit
        self._monthly_limits: dict[str, int] = {}    # tenant_id -> limit

    def set_daily_limit(self, tenant_id: str, limit: int) -> None:
        """Set daily token limit for a tenant. 0 = unlimited."""
        self._daily_limits[tenant_id] = max(0, limit)

    def set_monthly_limit(self, tenant_id: str, limit: int) -> None:
        """Set monthly token limit for a tenant. 0 = unlimited."""
        self._monthly_limits[tenant_id] = max(0, limit)

    def record_usage(
        self,
        run_id: str,
        tenant_id: str,
        agent_role: str,
        provider: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int = 0,
        latency_ms: float = 0.0,
        cached: bool = False,
    ) -> TokenUsage:
        """Record a new token usage entry."""
        usage = TokenUsage(
            run_id=run_id,
            tenant_id=tenant_id,
            agent_role=agent_role,
            provider=provider,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
            cached=cached,
        )
        self._records.append(usage)
        logger.debug(
            "token_usage recorded run_id=%s tenant=%s total=%d cached=%s",
            run_id, tenant_id, usage.total_tokens, cached,
        )
        return usage

    def record_from_chat_response(
        self,
        run_id: str,
        tenant_id: str,
        agent_role: str,
        provider: str,
        model: str,
        usage: dict[str, Any] | None,
        latency_ms: float = 0.0,
    ) -> TokenUsage | None:
        """Convenience: record usage from a ChatCompletionResponse usage dict."""
        if not usage:
            return None
        return self.record_usage(
            run_id=run_id,
            tenant_id=tenant_id,
            agent_role=agent_role,
            provider=provider,
            model=model,
            prompt_tokens=int(usage.get("prompt_tokens", 0) or 0),
            completion_tokens=int(usage.get("completion_tokens", 0) or 0),
            total_tokens=int(usage.get("total_tokens", 0) or 0),
            latency_ms=latency_ms,
        )

    def get_budget_status(self, tenant_id: str) -> BudgetStatus:
        """Get current budget status for a tenant."""
        daily_limit = self._daily_limits.get(tenant_id, 0)
        monthly_limit = self._monthly_limits.get(tenant_id, 0)

        now = time.time()
        day_start = now - (now % 86400)  # midnight UTC

        daily_tokens = sum(
            r.total_tokens for r in self._records
            if r.tenant_id == tenant_id and time.mktime(time.strptime(r.created_at, "%Y-%m-%dT%H:%M:%SZ")) >= day_start
        )

        month_start = now - (now % 2592000)  # approximate month start
        monthly_tokens = sum(
            r.total_tokens for r in self._records
            if r.tenant_id == tenant_id and time.mktime(time.strptime(r.created_at, "%Y-%m-%dT%H:%M:%SZ")) >= month_start
        )

        remaining_daily = max(0, daily_limit - daily_tokens) if daily_limit > 0 else -1
        remaining_monthly = max(0, monthly_limit - monthly_tokens) if monthly_limit > 0 else -1

        total_limit = daily_limit + monthly_limit
        total_used = daily_tokens + monthly_tokens
        pct = (total_used / total_limit * 100) if total_limit > 0 else 0.0

        return BudgetStatus(
            daily_tokens_used=daily_tokens,
            daily_limit=daily_limit,
            monthly_tokens_used=monthly_tokens,
            monthly_limit=monthly_limit,
            remaining_daily=remaining_daily,
            remaining_monthly=remaining_monthly,
            percentage_used=round(pct, 1),
            is_over_budget=(remaining_daily == 0 or remaining_monthly == 0) if (daily_limit > 0 or monthly_limit > 0) else False,
            is_warning=pct >= 80.0,
        )

    def can_use_tokens(self, tenant_id: str, estimated_tokens: int = 100) -> bool:
        """Check if a tenant can use estimated_tokens more without exceeding budget."""
        status = self.get_budget_status(tenant_id)
        if not status.daily_limit and not status.monthly_limit:
            return True
        if status.is_over_budget:
            return False
        return True

    def get_tenant_stats(self, tenant_id: str) -> dict[str, Any]:
        """Get usage statistics for a tenant."""
        records = [r for r in self._records if r.tenant_id == tenant_id]
        if not records:
            return {
                "total_requests": 0,
                "total_tokens": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "avg_latency_ms": 0.0,
                "cache_hit_rate": 0.0,
                "by_agent": {},
                "by_model": {},
            }

        total_prompt = sum(r.prompt_tokens for r in records)
        total_completion = sum(r.completion_tokens for r in records)
        total_tokens = sum(r.total_tokens for r in records)
        avg_latency = sum(r.latency_ms for r in records) / len(records)
        cache_hits = sum(1 for r in records if r.cached)

        by_agent: dict[str, dict[str, int]] = {}
        by_model: dict[str, int] = {}
        for r in records:
            if r.agent_role not in by_agent:
                by_agent[r.agent_role] = {"tokens": 0, "requests": 0}
            by_agent[r.agent_role]["tokens"] += r.total_tokens
            by_agent[r.agent_role]["requests"] += 1
            by_model[r.model] = by_model.get(r.model, 0) + r.total_tokens

        return {
            "total_requests": len(records),
            "total_tokens": total_tokens,
            "prompt_tokens": total_prompt,
            "completion_tokens": total_completion,
            "avg_latency_ms": round(avg_latency, 1),
            "cache_hit_rate": round(cache_hits / len(records) * 100, 1),
            "by_agent": by_agent,
            "by_model": by_model,
        }

    def clear_tenant_records(self, tenant_id: str) -> int:
        """Remove all records for a tenant. Returns count removed."""
        before = len(self._records)
        self._records = [r for r in self._records if r.tenant_id != tenant_id]
        return before - len(self._records)


# Global singleton
_budget_tracker: TokenBudgetTracker | None = None


def get_budget_tracker() -> TokenBudgetTracker:
    global _budget_tracker
    if _budget_tracker is None:
        _budget_tracker = TokenBudgetTracker()
    return _budget_tracker
