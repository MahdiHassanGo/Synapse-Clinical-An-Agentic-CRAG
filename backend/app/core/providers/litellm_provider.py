"""
LiteLLM Universal Provider.
Unifies OpenAI, Google Gemini, Anthropic, and local Ollama models with
standardized error handling, timeouts, cost tracking, and structured output.
"""
import os
import time
import json
from typing import List, Dict, Any, Type, Optional
import litellm
from pydantic import BaseModel

from app.core.providers.base import BaseLLMProvider, LLMMessage, LLMResponse, LLMTokenUsage

# Suppress litellm noisy logs
litellm.suppress_debug_info = True


class LiteLLMProvider(BaseLLMProvider):
    def __init__(self):
        self._provider_name = "litellm"

    @property
    def provider_name(self) -> str:
        return self._provider_name

    def is_available(self) -> bool:
        # Checks if OpenRouter, OpenAI, Gemini, Anthropic, or Ollama is configured
        has_openrouter = bool(os.environ.get("OPENROUTER_API_KEY"))
        has_openai = bool(os.environ.get("OPENAI_API_KEY"))
        has_gemini = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
        has_anthropic = bool(os.environ.get("ANTHROPIC_API_KEY"))
        has_ollama = bool(os.environ.get("OLLAMA_BASE_URL"))
        return has_openrouter or has_openai or has_gemini or has_anthropic or has_ollama

    def _resolve_model(self, model: str) -> tuple[str, Optional[str]]:
        openrouter_key = os.environ.get("OPENROUTER_API_KEY")
        if openrouter_key:
            if not model.startswith("openrouter/") and (
                ":free" in model
                or "openrouter" in model.lower()
                or os.environ.get("DEFAULT_LLM_PROVIDER") == "openrouter"
            ):
                return f"openrouter/{model}", openrouter_key
            if model.startswith("openrouter/"):
                return model, openrouter_key
        return model, None

    def _extract_content(self, choice: Any) -> str:
        msg = getattr(choice, "message", None)
        if not msg:
            return ""
        content = getattr(msg, "content", None) or getattr(msg, "reasoning_content", "") or ""
        if not content and hasattr(msg, "provider_specific_fields"):
            fields = getattr(msg, "provider_specific_fields", {}) or {}
            content = fields.get("reasoning", "")
        return content or ""

    def _extract_json_dict(self, raw_text: str) -> dict:
        clean = raw_text.strip()
        if "```json" in clean:
            clean = clean.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in clean:
            clean = clean.split("```", 1)[1].split("```", 1)[0].strip()
        s = clean.find("{")
        e = clean.rfind("}")
        if s != -1 and e != -1:
            clean = clean[s : e + 1]
        return json.loads(clean)

    async def generate(
        self,
        messages: List[LLMMessage],
        model: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        timeout_seconds: float = 30.0,
        **kwargs
    ) -> LLMResponse:
        start_time = time.time()
        resolved_model, openrouter_key = self._resolve_model(model)
        formatted_msgs = [{"role": m.role, "content": m.content} for m in messages]

        call_kwargs = dict(kwargs)
        if openrouter_key and resolved_model.startswith("openrouter/"):
            call_kwargs["api_key"] = openrouter_key

        # Call litellm acompletion
        response = await litellm.acompletion(
            model=resolved_model,
            messages=formatted_msgs,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout_seconds,
            **call_kwargs
        )

        latency = round((time.time() - start_time) * 1000.0, 2)
        choice = response.choices[0] if response.choices else None
        content = self._extract_content(choice) if choice else ""

        usage_data = getattr(response, "usage", None)
        p_tokens = (
            usage_data.prompt_tokens
            if usage_data
            else len(" ".join([m.content for m in messages]).split()) * 2
        )
        c_tokens = (
            usage_data.completion_tokens if usage_data else len(content.split()) * 2
        )
        t_tokens = p_tokens + c_tokens

        # Free tier models have zero cost
        if ":free" in resolved_model:
            cost = 0.0
        else:
            try:
                cost = litellm.completion_cost(completion_response=response)
            except Exception:
                cost = (p_tokens * 0.00000015) + (c_tokens * 0.00000060)

        # Detect provider from model name
        provider_tag = "litellm"
        if "openrouter" in resolved_model.lower():
            provider_tag = "openrouter"
        elif "gemini" in resolved_model.lower():
            provider_tag = "gemini"
        elif "gpt" in resolved_model.lower() or "openai" in resolved_model.lower():
            provider_tag = "openai"
        elif "claude" in resolved_model.lower():
            provider_tag = "anthropic"
        elif "ollama" in resolved_model.lower():
            provider_tag = "ollama"

        return LLMResponse(
            content=content,
            provider=provider_tag,
            model=resolved_model,
            usage=LLMTokenUsage(
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                estimated_cost_usd=round(cost, 6),
            ),
            latency_ms=latency,
            finish_reason=choice.finish_reason if choice else "stop",
            is_mock=False,
        )

    async def generate_structured(
        self,
        messages: List[LLMMessage],
        model: str,
        schema: Type[BaseModel],
        temperature: float = 0.0,
        timeout_seconds: float = 30.0,
        **kwargs
    ) -> Any:
        resolved_model, openrouter_key = self._resolve_model(model)
        formatted_msgs = [{"role": m.role, "content": m.content} for m in messages]
        formatted_msgs.append(
            {
                "role": "system",
                "content": f"You must respond with valid JSON matching this schema: {json.dumps(schema.model_json_schema())}. Output raw JSON only with no commentary.",
            }
        )

        call_kwargs = dict(kwargs)
        if openrouter_key and resolved_model.startswith("openrouter/"):
            call_kwargs["api_key"] = openrouter_key

        try:
            response = await litellm.acompletion(
                model=resolved_model,
                messages=formatted_msgs,
                temperature=temperature,
                response_format={"type": "json_object"},
                timeout=timeout_seconds,
                **call_kwargs
            )
        except Exception:
            # Fallback without response_format if provider raises error
            response = await litellm.acompletion(
                model=resolved_model,
                messages=formatted_msgs,
                temperature=temperature,
                timeout=timeout_seconds,
                **call_kwargs
            )

        choice = response.choices[0] if response.choices else None
        raw_text = self._extract_content(choice) if choice else "{}"
        data = self._extract_json_dict(raw_text)
        return schema.model_validate(data)

    async def get_embedding(
        self, text: str, model: str = "nvidia/nemotron-3-embed-1b:free"
    ) -> List[float]:
        resolved_model, openrouter_key = self._resolve_model(model)
        call_kwargs = {}
        if openrouter_key and resolved_model.startswith("openrouter/"):
            call_kwargs["api_key"] = openrouter_key

        response = await litellm.aembedding(
            model=resolved_model, input=[text], **call_kwargs
        )
        return response.data[0]["embedding"]
