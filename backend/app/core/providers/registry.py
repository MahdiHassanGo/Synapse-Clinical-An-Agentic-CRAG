"""
Provider Registry for Synapse Clinical.
Manages provider discovery, health monitoring, and resolution.
"""
from typing import Dict, Optional, List, Any
from app.core.providers.base import BaseLLMProvider
from app.core.providers.litellm_provider import LiteLLMProvider
from app.core.providers.mock_provider import ExplicitMockProvider


class ProviderRegistry:
    def __init__(self):
        self._providers: Dict[str, BaseLLMProvider] = {}
        self._register_default_providers()

    def _register_default_providers(self):
        # Universal LiteLLM provider
        self.register(LiteLLMProvider())
        # Explicit mock provider
        self.register(ExplicitMockProvider())

    def register(self, provider: BaseLLMProvider):
        self._providers[provider.provider_name.lower()] = provider

    def get_provider(self, name: str) -> Optional[BaseLLMProvider]:
        name_lower = name.lower()
        if name_lower in ["openrouter", "openai", "gemini", "anthropic", "ollama", "litellm"]:
            return self._providers.get("litellm")
        return self._providers.get(name_lower)

    def list_available_providers(self) -> List[Dict[str, Any]]:
        import os
        has_openrouter = bool(os.environ.get("OPENROUTER_API_KEY"))
        has_openai = bool(os.environ.get("OPENAI_API_KEY"))
        has_gemini = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
        has_anthropic = bool(os.environ.get("ANTHROPIC_API_KEY"))
        has_ollama = bool(os.environ.get("OLLAMA_BASE_URL"))

        return [
            {
                "provider_name": "openrouter",
                "is_available": has_openrouter,
                "active_models": [
                    os.environ.get("OPENROUTER_CHAT_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free"),
                    "qwen/qwen3.8-27b:free",
                    "google/gemma-4-31b-it:free",
                    "openrouter/free"
                ],
                "is_mock": False,
                "is_free_tier": True
            },
            {
                "provider_name": "openai",
                "is_available": has_openai,
                "active_models": ["gpt-4o-mini", "gpt-4o", "text-embedding-3-small"],
                "is_mock": False,
                "is_free_tier": False
            },
            {
                "provider_name": "gemini",
                "is_available": has_gemini,
                "active_models": ["gemini-2.5-flash", "gemini-1.5-pro"],
                "is_mock": False,
                "is_free_tier": False
            },
            {
                "provider_name": "anthropic",
                "is_available": has_anthropic,
                "active_models": ["claude-3-5-sonnet-20241022"],
                "is_mock": False,
                "is_free_tier": False
            },
            {
                "provider_name": "mock",
                "is_available": True,
                "active_models": ["mock-clinical-v2", "mock-embedding"],
                "is_mock": True,
                "is_free_tier": True
            }
        ]


provider_registry = ProviderRegistry()
