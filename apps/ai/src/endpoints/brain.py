"""
ZYRA Business Brain — API Endpoints
RESTful CRUD for Business Memory, Decisions, Events, Agents, Runs, and Tasks.
"""

from __future__ import annotations

import logging
import uuid as _uuid
from typing import Any

from fastapi import APIRouter, HTTPException

logger = logging.getLogger("zyra.endpoints.brain")
router = APIRouter()


def _resolve(tenant_id, tenant_slug):
    from main import _resolve_tenant
    return _resolve_tenant(tenant_id, tenant_slug)


# ══════════════════════════════════════════════════════════════════════════════
# Pydantic models (inline — matching the in-place style of main.py)
# ══════════════════════════════════════════════════════════════════════════════

from pydantic import BaseModel  # noqa: E402


# ── Memory ──────────────────────────────────────────────────────────────────

class MemoryCreateRequest(BaseModel):
    tenantId: str
    tenantSlug: str | None = None
    type: str
    content: str
    source: str | None = None
    confidence: float | None = None
    entityType: str | None = None
    entityId: str | None = None
    metadata: dict[str, Any] | None = None


class MemoryUpdateRequest(BaseModel):
    content: str | None = None
    source: str | None = None
    confidence: float | None = None
    entityType: str | None = None
    entityId: str | None = None
    metadata: dict[str, Any] | None = None


class MemorySearchRequest(BaseModel):
    tenantId: str
    tenantSlug: str | None = None
    query: str
    type: str | None = None
    limit: int = 10


class MemoryResponse(BaseModel):
    id: str
    tenantId: str
    type: str
    content: str
    source: str | None
    confidence: float | None
    entityType: str | None
    entityId: str | None
    metadata: Any
    createdAt: str
    updatedAt: str


# ── Decision ────────────────────────────────────────────────────────────────

class DecisionCreateRequest(BaseModel):
    tenantId: str
    tenantSlug: str | None = None
    title: str
    description: str | None = None
    rationale: str | None = None
    options: list[Any] | None = None
    decidedValue: Any | None = None
    impact: str | None = None
    confidence: float | None = None
    decidedBy: str | None = None


class DecisionUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    rationale: str | None = None
    options: list[Any] | None = None
    decidedValue: Any | None = None
    impact: str | None = None
    confidence: float | None = None
    decidedBy: str | None = None


class DecisionResponse(BaseModel):
    id: str
    tenantId: str
    title: str
    description: str | None
    rationale: str | None
    options: Any | None
    decidedValue: Any | None
    impact: str | None
    confidence: float | None
    decidedBy: str | None
    decidedAt: str | None
    createdAt: str
    updatedAt: str


# ── Event ───────────────────────────────────────────────────────────────────

class EventCreateRequest(BaseModel):
    tenantId: str
    tenantSlug: str | None = None
    type: str
    entityType: str | None = None
    entityId: str | None = None
    payload: dict[str, Any] | None = None


class EventResponse(BaseModel):
    id: str
    tenantId: str
    type: str
    entityType: str | None
    entityId: str | None
    payload: Any
    occurredAt: str
    createdAt: str


# ── Agent ───────────────────────────────────────────────────────────────────

class AgentCreateRequest(BaseModel):
    tenantId: str
    tenantSlug: str | None = None
    name: str
    description: str | None = None
    agentType: str = "general"
    config: dict[str, Any] | None = None
    autonomyLevel: int = 1


class AgentUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    type: str | None = None
    agentType: str | None = None
    config: dict[str, Any] | None = None
    autonomyLevel: int | None = None
    isActive: bool | None = None


class AgentResponse(BaseModel):
    id: str
    tenantId: str
    name: str
    description: str | None
    type: str
    agentType: str | None
    config: Any | None
    autonomyLevel: int
    isActive: bool
    createdAt: str
    updatedAt: str


# ── AgentRun ────────────────────────────────────────────────────────────────

class RunCreateRequest(BaseModel):
    tenantId: str
    tenantSlug: str | None = None
    agentId: str | None = None
    agentType: str | None = None
    userId: str | None = None
    input: dict[str, Any]


class RunUpdateRequest(BaseModel):
    status: str | None = None
    output: dict[str, Any] | None = None
    context: dict[str, Any] | None = None
    error: str | None = None
    startedAt: str | None = None
    completedAt: str | None = None


class RunResponse(BaseModel):
    id: str
    agentId: str | None
    agentType: str | None
    tenantId: str
    userId: str | None
    input: Any
    output: Any | None
    context: Any | None
    status: str
    error: str | None
    startedAt: str | None
    completedAt: str | None
    createdAt: str
    updatedAt: str


# ── AgentTask ───────────────────────────────────────────────────────────────

class TaskCreateRequest(BaseModel):
    tenantId: str
    tenantSlug: str | None = None
    agentId: str | None = None
    assignedTo: str | None = None
    title: str
    description: str | None = None
    priority: str = "MEDIUM"
    input: dict[str, Any] | None = None
    deadline: str | None = None


class TaskUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    assignedTo: str | None = None
    input: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    deadline: str | None = None


class TaskResponse(BaseModel):
    id: str
    tenantId: str
    agentId: str | None
    assignedTo: str | None
    title: str
    description: str | None
    priority: str
    status: str
    input: Any | None
    output: Any | None
    deadline: str | None
    completedAt: str | None
    createdAt: str
    updatedAt: str


# ══════════════════════════════════════════════════════════════════════════════
# Service imports (lazy to avoid circular with main.py)
# ══════════════════════════════════════════════════════════════════════════════

def _memory_svc():
    from brain.memory_service import MemoryService
    return MemoryService


def _decision_svc():
    from brain.decision_service import DecisionService
    return DecisionService


def _event_svc():
    from brain.event_service import EventService
    return EventService


def _agent_svc():
    from brain.agent_service import AgentService
    return AgentService


# ══════════════════════════════════════════════════════════════════════════════
# MEMORY ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/memories", response_model=MemoryResponse, status_code=201)
def create_memory(req: MemoryCreateRequest):
    tenant_id = _resolve(req.tenantId, req.tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant. Provide tenantId or tenantSlug.")

    svc = _memory_svc()
    record = svc.create_memory(
        tenant_id=tenant_id,
        type=req.type,
        content=req.content,
        source=req.source,
        confidence=req.confidence,
        entity_type=req.entityType,
        entity_id=req.entityId,
        metadata=req.metadata,
    )
    if not record:
        raise HTTPException(status_code=500, detail="Failed to create memory.")
    logger.info("memory created id=%s type=%s tenant=%s", record.get("id"), req.type, tenant_id)
    return record


@router.get("/memories")
def list_memories(tenantId: str | None = None, tenantSlug: str | None = None,
                  type: str | None = None, entityType: str | None = None,
                  entityId: str | None = None, limit: int = 50, offset: int = 0):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _memory_svc()
    rows, total = svc.list_memories(
        tenant_id, type=type, entity_type=entityType,
        entity_id=entityId, limit=limit, offset=offset,
    )
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


@router.get("/memories/{memory_id}")
def get_memory(memory_id: str, tenantId: str | None = None, tenantSlug: str | None = None):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _memory_svc()
    record = svc.get_memory(memory_id, tenant_id)
    if not record:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return record


@router.put("/memories/{memory_id}")
def update_memory(memory_id: str, req: MemoryUpdateRequest, tenantId: str | None = None, tenantSlug: str | None = None):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    svc = _memory_svc()
    record = svc.update_memory(memory_id, tenant_id, **updates)
    if not record:
        raise HTTPException(status_code=404, detail="Memory not found or update failed.")
    logger.info("memory updated id=%s tenant=%s", memory_id, tenant_id)
    return record


@router.delete("/memories/{memory_id}", status_code=204)
def delete_memory(memory_id: str, tenantId: str | None = None, tenantSlug: str | None = None):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _memory_svc()
    deleted = svc.delete_memory(memory_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found.")
    logger.info("memory deleted id=%s tenant=%s", memory_id, tenant_id)
    return None


@router.post("/memories/search")
def search_memories(req: MemorySearchRequest):
    tenant_id = _resolve(req.tenantId, req.tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _memory_svc()
    results = svc.search_memories(
        tenant_id=tenant_id,
        query=req.query,
        type=req.type,
        limit=req.limit,
    )
    return {"items": results, "count": len(results)}


# ══════════════════════════════════════════════════════════════════════════════
# DECISION ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/decisions", response_model=DecisionResponse, status_code=201)
def create_decision(req: DecisionCreateRequest):
    tenant_id = _resolve(req.tenantId, req.tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _decision_svc()
    record = svc.create_decision(
        tenant_id=tenant_id,
        title=req.title,
        description=req.description,
        rationale=req.rationale,
        options=req.options,
        decided_value=req.decidedValue,
        impact=req.impact,
        confidence=req.confidence,
        decided_by=req.decidedBy,
    )
    if not record:
        raise HTTPException(status_code=500, detail="Failed to create decision.")
    logger.info("decision created id=%s title=%s tenant=%s", record.get("id"), req.title, tenant_id)
    return record


@router.get("/decisions")
def list_decisions(tenantId: str | None = None, tenantSlug: str | None = None,
                   limit: int = 50, offset: int = 0):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _decision_svc()
    rows, total = svc.list_decisions(tenant_id, limit=limit, offset=offset)
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


@router.get("/decisions/{decision_id}")
def get_decision(decision_id: str, tenantId: str | None = None, tenantSlug: str | None = None):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _decision_svc()
    record = svc.get_decision(decision_id, tenant_id)
    if not record:
        raise HTTPException(status_code=404, detail="Decision not found.")
    return record


@router.put("/decisions/{decision_id}")
def update_decision(decision_id: str, req: DecisionUpdateRequest, tenantId: str | None = None, tenantSlug: str | None = None):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    svc = _decision_svc()
    record = svc.update_decision(decision_id, tenant_id, **updates)
    if not record:
        raise HTTPException(status_code=404, detail="Decision not found or update failed.")
    logger.info("decision updated id=%s tenant=%s", decision_id, tenant_id)
    return record


# ══════════════════════════════════════════════════════════════════════════════
# EVENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/events", response_model=EventResponse, status_code=201)
def log_event(req: EventCreateRequest):
    tenant_id = _resolve(req.tenantId, req.tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _event_svc()
    record = svc.log_event(
        tenant_id=tenant_id,
        event_type=req.type,
        entity_type=req.entityType,
        entity_id=req.entityId,
        payload=req.payload,
    )
    if not record:
        raise HTTPException(status_code=500, detail="Failed to log event.")
    logger.info("event logged id=%s type=%s tenant=%s", record.get("id"), req.type, tenant_id)
    return record


@router.get("/events")
def list_events(tenantId: str | None = None, tenantSlug: str | None = None,
                type: str | None = None, entityType: str | None = None,
                entityId: str | None = None, limit: int = 50, offset: int = 0):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _event_svc()
    rows, total = svc.get_events(
        tenant_id, event_type=type, entity_type=entityType,
        entity_id=entityId, limit=limit, offset=offset,
    )
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


# ══════════════════════════════════════════════════════════════════════════════
# AGENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/agents", response_model=AgentResponse, status_code=201)
def create_agent(req: AgentCreateRequest):
    tenant_id = _resolve(req.tenantId, req.tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _agent_svc()
    record = svc.create_agent(
        tenant_id=tenant_id,
        name=req.name,
        description=req.description,
        agent_type=req.agentType,
        config=req.config,
        autonomy_level=req.autonomyLevel,
    )
    if not record:
        raise HTTPException(status_code=500, detail="Failed to create agent.")
    logger.info("agent created id=%s name=%s tenant=%s", record.get("id"), req.name, tenant_id)
    return record


@router.get("/agents")
def list_agents(tenantId: str | None = None, tenantSlug: str | None = None):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _agent_svc()
    rows = svc.list_agents(tenant_id)
    return {"items": rows, "total": len(rows)}


@router.get("/agents/{agent_id}")
def get_agent(agent_id: str, tenantId: str | None = None, tenantSlug: str | None = None):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _agent_svc()
    record = svc.get_agent_by_id(agent_id, tenant_id)
    if not record:
        raise HTTPException(status_code=404, detail="Agent not found.")
    return record


@router.put("/agents/{agent_id}")
def update_agent(agent_id: str, req: AgentUpdateRequest, tenantId: str | None = None, tenantSlug: str | None = None):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    svc = _agent_svc()
    record = svc.update_agent(agent_id, tenant_id, **updates)
    if not record:
        raise HTTPException(status_code=404, detail="Agent not found or update failed.")
    logger.info("agent updated id=%s tenant=%s", agent_id, tenant_id)
    return record


# ── Agent Runs ───────────────────────────────────────────────────────────────

@router.post("/agents/runs", response_model=RunResponse, status_code=201)
def create_run(req: RunCreateRequest):
    tenant_id = _resolve(req.tenantId, req.tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _agent_svc()
    record = svc.create_run(
        tenant_id=tenant_id,
        agent_id=req.agentId,
        agent_type=req.agentType,
        user_id=req.userId,
        input_data=req.input,
    )
    if not record:
        raise HTTPException(status_code=500, detail="Failed to create run.")
    logger.info("run created id=%s agent_type=%s tenant=%s", record.get("id"), req.agentType, tenant_id)
    return record


@router.get("/agents/runs")
def list_runs(tenantId: str | None = None, tenantSlug: str | None = None,
              status: str | None = None, limit: int = 50, offset: int = 0):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _agent_svc()
    rows, total = svc.list_runs(tenant_id, status=status, limit=limit, offset=offset)
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


@router.put("/agents/runs/{run_id}")
def update_run(run_id: str, req: RunUpdateRequest, tenantId: str | None = None, tenantSlug: str | None = None):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    svc = _agent_svc()
    record = svc.update_run(run_id, tenant_id, **updates)
    if not record:
        raise HTTPException(status_code=404, detail="Run not found or update failed.")
    logger.info("run updated id=%s tenant=%s", run_id, tenant_id)
    return record


# ── Agent Tasks ──────────────────────────────────────────────────────────────

@router.post("/agents/tasks", response_model=TaskResponse, status_code=201)
def create_task(req: TaskCreateRequest):
    tenant_id = _resolve(req.tenantId, req.tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _agent_svc()
    record = svc.create_task(
        tenant_id=tenant_id,
        agent_id=req.agentId,
        assigned_to=req.assignedTo,
        title=req.title,
        description=req.description,
        priority=req.priority,
        input_data=req.input,
        deadline=req.deadline,
    )
    if not record:
        raise HTTPException(status_code=500, detail="Failed to create task.")
    logger.info("task created id=%s title=%s tenant=%s", record.get("id"), req.title, tenant_id)
    return record


@router.get("/agents/tasks")
def list_tasks(tenantId: str | None = None, tenantSlug: str | None = None,
               status: str | None = None, priority: str | None = None,
               limit: int = 50, offset: int = 0):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    svc = _agent_svc()
    rows, total = svc.list_tasks(tenant_id, status=status, priority=priority, limit=limit, offset=offset)
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


@router.put("/agents/tasks/{task_id}")
def update_task(task_id: str, req: TaskUpdateRequest, tenantId: str | None = None, tenantSlug: str | None = None):
    tenant_id = _resolve(tenantId, tenantSlug)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Could not resolve tenant.")

    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    svc = _agent_svc()
    record = svc.update_task(task_id, tenant_id, **updates)
    if not record:
        raise HTTPException(status_code=404, detail="Task not found or update failed.")
    logger.info("task updated id=%s tenant=%s", task_id, tenant_id)
    return record
