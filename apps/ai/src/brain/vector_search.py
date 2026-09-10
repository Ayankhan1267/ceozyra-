"""
ZYRA AI Gateway — Vector Search
pgvector-powered semantic search for Business Brain memories.
Falls back to ILIKE search when pgvector extension is unavailable.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("zyra.brain.vector")


class VectorSearch:
    """
    Semantic search over business memories using pgvector.
    Provides embedding generation and similarity search.
    """

    def __init__(self):
        self._available = False
        self._check_pgvector()

    def _check_pgvector(self) -> None:
        """Check if pgvector extension is available in the database."""
        try:
            from main import _query_one
            row = _query_one(
                "SELECT 1 FROM pg_extension WHERE extname = 'vector'",
                (),
            )
            self._available = row is not None
            if self._available:
                logger.info("pgvector extension is available for semantic search")
            else:
                logger.info("pgvector extension not available, using ILIKE fallback")
        except Exception as exc:
            logger.debug("pgvector check failed: %s", exc)
            self._available = False

    @property
    def is_available(self) -> bool:
        return self._available

    def search(
        self,
        tenant_id: str,
        query: str,
        memory_type: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Search memories using semantic similarity.

        Falls back to ILIKE search if pgvector is not available.
        """
        if not self._available:
            return self._fallback_search(tenant_id, query, memory_type, limit)

        try:
            from main import _query_all
            from main import _query_one
            import psycopg2.extras

            # Generate embedding for the query
            query_embedding = self._generate_embedding(query)
            if not query_embedding:
                return self._fallback_search(tenant_id, query, memory_type, limit)

            # Build query with optional type filter
            where_clauses = ['"tenantId" = %s', '"embedding" IS NOT NULL']
            params: list[Any] = [tenant_id]

            if memory_type:
                where_clauses.append('"type" = %s')
                params.append(memory_type)

            where = " AND ".join(where_clauses)
            sql = f"""
                SELECT id, "tenantId", type, content, source, confidence,
                       "entityType", "entityId", metadata, "createdAt", "updatedAt",
                       1 - ("embedding" <=> %s::vector) AS similarity
                FROM "business_memories"
                WHERE {where}
                ORDER BY "embedding" <=> %s::vector
                LIMIT %s
            """
            params.extend([str(query_embedding), str(query_embedding), limit])

            rows = _query_all(sql, tuple(params))
            results = []
            for r in rows:
                result = {
                    "id": r.get("id"),
                    "tenant_id": str(r.get("tenantId", "")),
                    "type": str(r.get("type", "")),
                    "content": str(r.get("content", "")),
                    "source": r.get("source"),
                    "confidence": r.get("confidence"),
                    "entity_type": r.get("entityType"),
                    "entity_id": r.get("entityId"),
                    "metadata": r.get("metadata") or {},
                    "created_at": str(r.get("createdAt", "")),
                    "similarity": round(float(r.get("similarity", 0)), 4),
                }
                results.append(result)
            return results

        except Exception as exc:
            logger.warning("vector search failed, falling back to ILIKE: %s", exc)
            return self._fallback_search(tenant_id, query, memory_type, limit)

    def _generate_embedding(self, text: str) -> list[float] | None:
        """Generate an embedding vector for the given text."""
        try:
            # Try to use the AI provider's embed endpoint
            from config.settings import get_settings
            from providers.factory import ProviderFactory

            settings = get_settings()
            provider = ProviderFactory.create_from_settings()
            if provider is None:
                return None

            result = provider.embed(text)
            if result and "embedding" in result:
                return result["embedding"]
        except Exception as exc:
            logger.debug("embedding generation failed: %s", exc)
        return None

    def _fallback_search(
        self,
        tenant_id: str,
        query: str,
        memory_type: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Fallback ILIKE search when pgvector is unavailable."""
        from brain.memory_service import MemoryService

        return MemoryService.search_memories(
            tenant_id=tenant_id,
            query=query,
            type=memory_type,
            limit=limit,
        )

    def index_memory(self, memory_id: str, tenant_id: str, content: str) -> bool:
        """
        Generate and store embedding for a memory.
        Returns True if successful, False otherwise.
        """
        if not self._available:
            return False

        try:
            embedding = self._generate_embedding(content)
            if not embedding:
                return False

            from main import _execute_returning
            import psycopg2.extras

            sql = """
                UPDATE "business_memories"
                SET "embedding" = %s::vector
                WHERE id = %s AND "tenantId" = %s
            """
            _execute_returning(sql, (psycopg2.extras.Json(embedding), memory_id, tenant_id))
            return True
        except Exception as exc:
            logger.debug("index_memory failed: %s", exc)
            return False


# Global singleton
_vector_search: VectorSearch | None = None


def get_vector_search() -> VectorSearch:
    global _vector_search
    if _vector_search is None:
        _vector_search = VectorSearch()
    return _vector_search
