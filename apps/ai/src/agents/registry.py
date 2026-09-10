"""
ZYRA AI Gateway — Agent registry and routing
Defines ZYRA's C-suite agent personas and classifies user messages to the right agent.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

logger = logging.getLogger("zyra.agents.registry")


class AgentRole(str, Enum):
    CEO = "ceo"
    CFO = "cfo"
    CMO = "cmo"
    COO = "coo"
    SALES = "sales"
    GENERAL = "general"


@dataclass
class AgentDefinition:
    role: AgentRole
    label: str
    description: str
    system_prompt: str
    keywords: list[str] = field(default_factory=list)


_AGENT_REGISTRY: dict[AgentRole, AgentDefinition] = {}


def _build_registry() -> dict[AgentRole, AgentDefinition]:
    global _AGENT_REGISTRY
    if _AGENT_REGISTRY:
        return _AGENT_REGISTRY

    _AGENT_REGISTRY = {
        AgentRole.CEO: AgentDefinition(
            role=AgentRole.CEO,
            label="CEO",
            description="Chief Executive Officer — overall business health, strategic decisions, growth",
            keywords=["ceo", "growth", "strategy", "overall", "business", "revenue", "performance", "vision"],
            system_prompt=(
                "You are ZYRA's CEO agent. You provide executive-level strategic guidance "
                "for a DTC e-commerce / affiliate commerce business. "
                "Focus on revenue trends, growth opportunities, market positioning, and overall business health. "
                "Give concise, actionable recommendations. Use bullet points for clarity. "
                "Always ground your analysis in the provided business metrics."
            ),
        ),
        AgentRole.CFO: AgentDefinition(
            role=AgentRole.CFO,
            label="CFO",
            description="Chief Financial Officer — margins, costs, profitability, financial planning",
            keywords=["cfo", "finance", "margin", "profit", "cost", "budget", "cash flow", "cogs", "pricing", "expense"],
            system_prompt=(
                "You are ZYRA's CFO agent. You analyse financial health: margins, COGS, "
                "commission liabilities, discounting, pricing strategy, and cash flow. "
                "Be precise with numbers. Flag anything below healthy thresholds (e.g. gross margin < 30%). "
                "Always reference the actual financial metrics provided in the context."
            ),
        ),
        AgentRole.CMO: AgentDefinition(
            role=AgentRole.CMO,
            label="CMO",
            description="Chief Marketing Officer — customer acquisition, retention, brand, channels",
            keywords=["cmo", "marketing", "customers", "acquisition", "retention", "brand", "channel", "ads", "campaign"],
            system_prompt=(
                "You are ZYRA's CMO agent. You focus on customer acquisition, retention, "
                "brand positioning, marketing channel effectiveness, and customer lifecycle. "
                "Use the customer source breakdown and repeat-buyer data to inform recommendations. "
                "Be specific about which channels to invest in or cut."
            ),
        ),
        AgentRole.COO: AgentDefinition(
            role=AgentRole.COO,
            label="COO",
            description="Chief Operating Officer — fulfillment, inventory, operations, logistics",
            keywords=["coo", "operations", "fulfillment", "inventory", "stock", "logistics", "shipping", "operations"],
            system_prompt=(
                "You are ZYRA's COO agent. You oversee operational efficiency: order fulfillment times, "
                "inventory levels, stock-outs, order status distribution, and logistics bottlenecks. "
                "Prioritise actions that reduce fallout rate and prevent stock-outs. "
                "Reference the actual operational metrics provided."
            ),
        ),
        AgentRole.SALES: AgentDefinition(
            role=AgentRole.SALES,
            label="Sales Agent",
            description="Sales-specific analysis, top products, conversion, partner performance",
            keywords=["sales", "top product", "conversion", "bestseller", "partner", "commission", "affiliate", "lead"],
            system_prompt=(
                "You are ZYRA's Sales agent. You analyse sales performance, top-selling products, "
                "conversion rates, affiliate / partner performance, and commission payouts. "
                "Identify top sellers and suggest cross-sell opportunities. "
                "Ground recommendations in the actual sales data provided."
            ),
        ),
    }
    return _AGENT_REGISTRY


def get_agent(role: AgentRole) -> AgentDefinition:
    registry = _build_registry()
    agent = registry.get(role)
    if agent is None:
        return registry[AgentRole.GENERAL]
    return agent


def get_all_agents() -> list[AgentDefinition]:
    return list(_build_registry().values())


def classify_message(message: str) -> AgentRole:
    """Classify a user message to the most appropriate ZYRA agent role using keyword matching."""
    q = message.lower()
    registry = _build_registry()

    scores: dict[AgentRole, int] = {}
    for role, agent in registry.items():
        score = sum(1 for kw in agent.keywords if kw in q)
        scores[role] = score

    best_role = max(scores, key=lambda r: scores[r])
    if scores[best_role] == 0:
        return AgentRole.GENERAL
    return best_role


def build_system_prompt(
    role: AgentRole,
    tenant_context_str: str,
    conversation_history: list[dict[str, str]] | None = None,
    extra_context: dict[str, Any] | None = None,
) -> str:
    agent = get_agent(role)
    prompt_parts: list[str] = [
        agent.system_prompt,
        "",
        "--- CURRENT BUSINESS CONTEXT ---",
        tenant_context_str,
        "--- END CONTEXT ---",
    ]

    if extra_context:
        prompt_parts.extend(["", "--- ADDITIONAL CONTEXT ---"])
        for k, v in extra_context.items():
            prompt_parts.append(f"{k}: {v}")
        prompt_parts.append("--- END ADDITIONAL CONTEXT ---")

    if conversation_history:
        prompt_parts.extend(["", "--- RECENT CONVERSATION ---"])
        for turn in conversation_history[-6:]:
            prompt_parts.append(f"{turn.get('role', 'user').upper()}: {turn.get('content', '')}")
        prompt_parts.append("--- END CONVERSATION ---")

    prompt_parts.append(
        "\nAnswer the user's question concisely and data-driven. "
        "If the context does not contain relevant data, say so honestly."
    )
    return "\n".join(prompt_parts)
