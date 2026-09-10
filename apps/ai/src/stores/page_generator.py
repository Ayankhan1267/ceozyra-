/**
 * ZYRA — AI Page Generator
 * Uses the provider factory to generate page content for different page types.
 */

from __future__ import annotations

import logging
from typing import Any

from providers.factory import ProviderFactory
from providers.base import ChatMessage, ChatCompletionRequest

logger = logging.getLogger("zyra.stores.page_generator")


PAGE_TYPE_PROMPTS: dict[str, str] = {
    "HOMEPAGE": (
        "Generate a compelling homepage for an online store. "
        "Include a hero section with a headline and CTA, featured products section, "
        "trust badges, and a brief brand introduction. "
        "Return JSON with keys: hero, featured, about."
    ),
    "PRODUCT": (
        "Generate a product page template with product description, "
        "key features, specifications, and a compelling buy-section CTA. "
        "Return JSON with keys: description, features, specifications, cta."
    ),
    "COLLECTION": (
        "Generate a collection page for a curated product category. "
        "Include a collection description, grid layout suggestion, and filter options. "
        "Return JSON with keys: description, layout, filters."
    ),
    "ABOUT": (
        "Generate an About Us page with the brand story, mission, values, and team introduction. "
        "Return JSON with keys: story, mission, values, team."
    ),
    "FAQ": (
        "Generate a comprehensive FAQ page with common questions and answers "
        "organized by category. Return JSON with keys: categories (list of objects with questions)."
    ),
    "CONTACT": (
        "Generate a contact page with contact form fields, business hours, "
        "address, and social links. Return JSON with keys: formFields, hours, address, social."
    ),
    "POLICIES": (
        "Generate policies pages (returns, shipping, privacy, terms) content. "
        "Return JSON with keys: returns, shipping, privacy, terms."
    ),
    "CUSTOM": (
        "Generate a custom page section with flexible content blocks. "
        "Return JSON with keys: blocks (list of content block objects)."
    ),
}


class PageGenerator:
    """Generates page content using AI based on page type and store context."""

    def __init__(self, provider=None):
        self._provider = provider

    @property
    def provider(self):
        if self._provider is None:
            from providers.factory import ProviderFactory
            self._provider = ProviderFactory.create_from_settings()
        return self._provider

    async def generate_page_content(
        self,
        page_type: str,
        store_name: str,
        store_description: str | None = None,
        industry: str | None = None,
    ) -> dict[str, Any]:
        """Generate structured content for a given page type.

        Args:
            page_type: One of the PageType enum values.
            store_name: Name of the store for personalization.
            store_description: Optional store description for context.
            industry: Optional industry vertical for better content.

        Returns:
            Parsed JSON content dict for the page.
        """
        page_type_upper = page_type.upper()
        prompt_template = PAGE_TYPE_PROMPTS.get(
            page_type_upper, PAGE_TYPE_PROMPTS["CUSTOM"]
        )

        context_parts = [f"Store name: {store_name}"]
        if store_description:
            context_parts.append(f"Store description: {store_description}")
        if industry:
            context_parts.append(f"Industry: {industry}")

        context = "\n".join(context_parts)
        system_prompt = (
            "You are a professional e-commerce content writer. "
            "Generate well-structured, conversion-optimized content in valid JSON format. "
            "Never include markdown fences. Return only raw JSON."
        )
        user_prompt = (
            f"{context}\n\n{prompt_template}\n\n"
            "Respond with ONLY the JSON object, no additional text."
        )

        messages = [
            ChatMessage(role="system", content=system_prompt),
            ChatMessage(role="user", content=user_prompt),
        ]

        try:
            request = ChatCompletionRequest(
                messages=messages,
                temperature=0.7,
                max_tokens=2048,
            )
            response = await self.provider.chat(request)
            raw = response.choices[0]["message"]["content"].strip()
            # Strip code fences if the provider adds them
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            import json
            return json.loads(raw)
        except Exception as exc:
            logger.error("Failed to generate page content for %s: %s", page_type, exc)
            return self._fallback_content(page_type_upper)

    async def generate_seo(
        self, page_type: str, store_name: str
    ) -> tuple[str, str]:
        """Generate SEO title and meta description for a page."""
        system = (
            "You are an SEO specialist. Generate a concise, compelling SEO title "
            "(max 60 chars) and meta description (max 160 chars). "
            "Respond in this exact format: TITLE: <title>\nDESCRIPTION: <description>"
        )
        user = f"Page type: {page_type}, Store: {store_name}"

        try:
            request = ChatCompletionRequest(
                messages=[
                    ChatMessage(role="system", content=system),
                    ChatMessage(role="user", content=user),
                ],
                temperature=0.5,
                max_tokens=200,
            )
            response = await self.provider.chat(request)
            text = response.choices[0]["message"]["content"].strip()
            title = ""
            description = ""
            for line in text.splitlines():
                if line.startswith("TITLE:"):
                    title = line.split(":", 1)[1].strip()
                elif line.startswith("DESCRIPTION:"):
                    description = line.split(":", 1)[1].strip()
            return title, description
        except Exception:
            return f"{store_name} - {page_type}", f"Explore {store_name}. {page_type} page."

    def _fallback_content(self, page_type: str) -> dict[str, Any]:
        return {"message": f"Default {page_type} content — replace with AI-generated copy."}


# Module-level singleton
_generator: PageGenerator | None = None


def get_page_generator() -> PageGenerator:
    global _generator
    if _generator is None:
        _generator = PageGenerator()
    return _generator
