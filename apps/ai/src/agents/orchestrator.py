"""
ZYRA AI Gateway — Agent Orchestrator
Manages agent workflows, state transitions, and tool invocation chains.
Provides a clean interface for running complex multi-step agent tasks.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from agents.registry import AgentRole, classify_message, get_agent

logger = logging.getLogger("zyra.orchestrator")


class WorkflowStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class WorkflowStep:
    """A single step in an agent workflow."""
    id: str
    name: str
    agent_role: AgentRole | None
    tool_name: str | None
    parameters: dict[str, Any] = field(default_factory=dict)
    status: str = StepStatus.PENDING.value
    result: dict[str, Any] | None = None
    error: str | None = None
    started_at: str | None = None
    completed_at: str | None = None

    def __post_init__(self):
        if not self.id:
            self.id = uuid.uuid4().hex


@dataclass
class Workflow:
    """An agent workflow with ordered steps."""
    id: str
    name: str
    tenant_id: str
    agent_role: AgentRole | None
    steps: list[WorkflowStep] = field(default_factory=list)
    status: str = WorkflowStatus.PENDING.value
    input: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    created_at: str = ""

    def __post_init__(self):
        if not self.id:
            self.id = uuid.uuid4().hex
        if not self.created_at:
            self.created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class AgentOrchestrator:
    """
    Coordinates agent execution across multiple steps.
    Supports sequential and conditional workflows.
    """

    def __init__(self):
        self._workflows: dict[str, Workflow] = {}
        self._tool_executor = None
        self._budget_tracker = None
        self._notification_service = None
        self._audit_logger = None

    def _get_tool_executor(self):
        if self._tool_executor is None:
            from tools.executor import get_tool_executor
            self._tool_executor = get_tool_executor()
        return self._tool_executor

    def _get_budget_tracker(self):
        if self._budget_tracker is None:
            from monitoring.budget_tracker import get_budget_tracker
            self._budget_tracker = get_budget_tracker()
        return self._budget_tracker

    def _get_notification_service(self):
        if self._notification_service is None:
            from monitoring.notifications import get_notification_service
            self._notification_service = get_notification_service()
        return self._notification_service

    def _get_audit_logger(self):
        if self._audit_logger is None:
            from monitoring.audit_logger import get_audit_logger
            self._audit_logger = get_audit_logger()
        return self._audit_logger

    def create_workflow(
        self,
        name: str,
        tenant_id: str,
        agent_role: str | None,
        steps: list[dict[str, Any]] | None = None,
        input_data: dict[str, Any] | None = None,
    ) -> Workflow:
        """Create a new workflow with the given steps."""
        role = None
        if agent_role:
            try:
                role = AgentRole(agent_role.lower())
            except ValueError:
                role = AgentRole.GENERAL

        workflow_steps = []
        for i, step_def in enumerate(steps or []):
            step_role = None
            if step_def.get("agent_role"):
                try:
                    step_role = AgentRole(step_def["agent_role"].lower())
                except ValueError:
                    step_role = None

            workflow_steps.append(WorkflowStep(
                id=step_def.get("id", uuid.uuid4().hex),
                name=step_def.get("name", f"step_{i}"),
                agent_role=step_role,
                tool_name=step_def.get("tool"),
                parameters=step_def.get("parameters", {}),
            ))

        workflow = Workflow(
            id=uuid.uuid4().hex,
            name=name,
            tenant_id=tenant_id,
            agent_role=role,
            steps=workflow_steps,
            input=input_data or {},
        )

        self._workflows[workflow.id] = workflow
        logger.info(
            "workflow created id=%s name=%s steps=%d tenant=%s",
            workflow.id, name, len(workflow_steps), tenant_id,
        )
        return workflow

    async def execute_workflow(self, workflow_id: str) -> Workflow:
        """Execute all steps in a workflow sequentially."""
        workflow = self._workflows.get(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        budget = self._get_budget_tracker()
        notifications = self._get_notification_service()
        audit = self._get_audit_logger()

        workflow.status = WorkflowStatus.RUNNING.value
        workflow.started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        audit.log(
            tenant_id=workflow.tenant_id,
            action="workflow.started",
            actor_type="system",
            actor_id="orchestrator",
            resource_type="workflow",
            resource_id=workflow.id,
            metadata={"name": workflow.name, "steps": len(workflow.steps)},
        )

        try:
            for step in workflow.steps:
                step.status = StepStatus.RUNNING.value
                step.started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

                try:
                    result = await self._execute_step(workflow, step)
                    step.result = result
                    step.status = StepStatus.COMPLETED.value
                    step.completed_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

                    workflow.output[f"step_{step.id}"] = result

                except Exception as exc:
                    step.status = StepStatus.FAILED.value
                    step.error = str(exc)
                    step.completed_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    logger.error("workflow step failed workflow=%s step=%s error=%s", workflow_id, step.id, exc)

                    # Record budget usage even on failure
                    if step.tool_name:
                        budget.record_usage(
                            run_id=workflow.id,
                            tenant_id=workflow.tenant_id,
                            agent_role=step.agent_role.value if step.agent_role else "orchestrator",
                            provider="system",
                            model="tool_executor",
                            total_tokens=0,
                        )

                    notifications.notify_error(
                        tenant_id=workflow.tenant_id,
                        title=f"Workflow step failed: {step.name}",
                        message=str(exc),
                    )
                    raise

            workflow.status = WorkflowStatus.COMPLETED.value
            audit.log(
                tenant_id=workflow.tenant_id,
                action="workflow.completed",
                actor_type="system",
                actor_id="orchestrator",
                resource_type="workflow",
                resource_id=workflow.id,
                metadata={"name": workflow.name, "output_keys": list(workflow.output.keys())},
            )

        except Exception as exc:
            workflow.status = WorkflowStatus.FAILED.value
            workflow.error = str(exc)
            audit.log(
                tenant_id=workflow.tenant_id,
                action="workflow.failed",
                actor_type="system",
                actor_id="orchestrator",
                resource_type="workflow",
                resource_id=workflow.id,
                metadata={"name": workflow.name, "error": str(exc)[:200]},
            )

        workflow.completed_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return workflow

    async def _execute_step(self, workflow: Workflow, step: WorkflowStep) -> dict[str, Any]:
        """Execute a single workflow step."""
        if step.tool_name:
            # Route to tool executor
            tool_executor = self._get_tool_executor()
            result = await tool_executor.execute(
                tool_name=step.tool_name,
                tenant_id=workflow.tenant_id,
                parameters=step.parameters,
                run_id=workflow.id,
            )
            return result

        elif step.agent_role:
            # Route to agent chat
            agent_def = get_agent(step.agent_role)
            from config.settings import get_settings
            from providers.factory import ProviderFactory
            from providers.base import ChatCompletionRequest, ChatMessage

            settings = get_settings()
            provider = ProviderFactory.create_from_settings()

            user_message = step.parameters.get("message", "")
            messages = [
                ChatMessage(role="system", content=agent_def.system_prompt),
                ChatMessage(role="user", content=user_message),
            ]

            request = ChatCompletionRequest(
                messages=messages,
                model=settings.OLLAMA_MODEL,
                stream=False,
                temperature=settings.AGENT_TEMPERATURE,
                max_tokens=1024,
            )

            result = await provider.chat(request)
            content = ""
            if result.choices:
                content = result.choices[0].get("message", {}).get("content", "") or ""

            return {
                "content": content,
                "model": result.model,
                "provider": provider.name,
                "usage": result.usage,
            }

        else:
            raise ValueError(f"Step '{step.name}' has no tool or agent_role defined")

    def get_workflow(self, workflow_id: str) -> Workflow | None:
        """Get a workflow by ID."""
        return self._workflows.get(workflow_id)

    def list_workflows(self, tenant_id: str) -> list[Workflow]:
        """List all workflows for a tenant."""
        return [w for w in self._workflows.values() if w.tenant_id == tenant_id]


# Built-in workflow templates
WORKFLOW_TEMPLATES: dict[str, dict[str, Any]] = {
    "business_review": {
        "name": "Full Business Review",
        "description": "Run all C-suite agents to get a complete business review",
        "agent_role": "ceo",
        "steps": [
            {"name": "CEO Overview", "agent_role": "ceo", "parameters": {"message": "Provide a complete business overview with key metrics and recommendations."}},
            {"name": "CFO Analysis", "agent_role": "cfo", "parameters": {"message": "Analyze financial health: margins, costs, and profitability."}},
            {"name": "CMO Insights", "agent_role": "cmo", "parameters": {"message": "Analyze customer acquisition, retention, and marketing effectiveness."}},
            {"name": "COO Report", "agent_role": "coo", "parameters": {"message": "Report on operational efficiency: fulfillment, inventory, and order status."}},
        ],
    },
    "weekly_report": {
        "name": "Weekly Automated Report",
        "description": "Generate a weekly business report using BI tools",
        "agent_role": "ceo",
        "steps": [
            {"name": "Get Overview", "tool": "get_business_overview", "parameters": {"period": "week"}},
            {"name": "Get Sales", "tool": "get_sales_data", "parameters": {"limit": 20}},
            {"name": "Get Finance", "tool": "get_financial_summary", "parameters": {"period": "week"}},
        ],
    },
    "memory_search": {
        "name": "Brain Memory Search",
        "description": "Search business memory for relevant context",
        "agent_role": "general",
        "steps": [
            {"name": "Search Memories", "tool": "search_memories", "parameters": {"query": "", "limit": 10}},
        ],
    },
}


# Global singleton
_agent_orchestrator: AgentOrchestrator | None = None


def get_agent_orchestrator() -> AgentOrchestrator:
    global _agent_orchestrator
    if _agent_orchestrator is None:
        _agent_orchestrator = AgentOrchestrator()
    return _agent_orchestrator
