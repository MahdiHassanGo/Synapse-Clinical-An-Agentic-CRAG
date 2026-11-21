"""
Abstract Base LLM Provider.
Defines standard contracts for generation, structured output, embeddings, and health checks.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Type
from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    role: str  # system, user, assistant
    content: str


class LLMTokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


class LLMResponse(BaseModel):
    content: str
    provider: str
    model: str
    usage: LLMTokenUsage
    latency_ms: float
    finish_reason: Optional[str] = None
    is_mock: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BaseLLMProvider(ABC):
    """Abstract interface that every LLM provider must implement."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider (e.g. openai, gemini, anthropic, ollama, mock)."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Returns True if provider credentials/daemon are configured and reachable."""
        pass

    @abstractmethod
    async def generate(
        self,
        messages: List[LLMMessage],
        model: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        timeout_seconds: float = 30.0,
        **kwargs
    ) -> LLMResponse:
        """Generates text response from the model."""
        pass

    @abstractmethod
    async def generate_structured(
        self,
        messages: List[LLMMessage],
        model: str,
        schema: Type[BaseModel],
        temperature: float = 0.0,
        timeout_seconds: float = 30.0,
        **kwargs
    ) -> Any:
        """Generates response strictly conforming to the given Pydantic schema."""
        pass

    @abstractmethod
    async def get_embedding(
        self,
        text: str,
        model: str = "text-embedding-3-small"
    ) -> List[float]:
        """Generates embedding vector for the given text."""
        pass
