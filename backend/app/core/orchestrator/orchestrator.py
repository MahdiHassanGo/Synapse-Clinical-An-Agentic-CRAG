"""
Custom Model Orchestrator for Synapse Clinical.
Intelligently routes tasks to appropriate models based on quality, latency, cost, and availability.
Enforces that deterministic clinical calculators and drug safety rules NEVER invoke an LLM.
"""
import os
import time
from typing import Dict, Any, List, Optional, Type
from pydantic import BaseModel

from app.core.config import settings
from app.core.providers.base import LLMMessage, LLMResponse, BaseLLMProvider
from app.core.providers.registry import provider_registry
from app.core.orchestrator.models import OrchestratorTask, ModelRoutingDecision


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, cooldown_seconds: float = 60.0):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.failure_count: Dict[str, int] = {}
        self.last_failure_time: Dict[str, float] = {}

    def record_failure(self, provider_model: str):
        self.failure_count[provider_model] = self.failure_count.get(provider_model, 0) + 1
        self.last_failure_time[provider_model] = time.time()

    def record_success(self, provider_model: str):
        self.failure_count[provider_model] = 0

    def is_open(self, provider_model: str) -> bool:
        failures = self.failure_count.get(provider_model, 0)
        if failures < self.failure_threshold:
            return False
        # Check cooldown
        last = self.last_failure_time.get(provider_model, 0)
        if time.time() - last > self.cooldown_seconds:
            self.failure_count[provider_model] = 0
            return False
        return True


class ModelOrchestrator:
    def __init__(self):
        self.circuit_breaker = CircuitBreaker()
        self.execution_decisions: List[ModelRoutingDecision] = []

    def get_task_routing_plan(self, task: OrchestratorTask) -> List[Dict[str, str]]:
        """
        Returns an ordered list of candidate (provider, model) options for each task.
        Prioritizes:
        - When OPENROUTER_API_KEY is configured: Strictly uses user-selected free models (Zero cost).
        - Router & Query Rewriter: Fast, cost-efficient model.
        - Clinical Synthesis: High-reasoning model.
        - Evidence Verification: Independent evaluator model.
        - Embedding: Dedicated embedding model.
        """
        has_openrouter = bool(os.environ.get("OPENROUTER_API_KEY"))
        or_chat = os.environ.get("OPENROUTER_CHAT_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free")
        if not or_chat.startswith("openrouter/"):
            or_chat = f"openrouter/{or_chat}"

        or_fallbacks_raw = os.environ.get(
            "OPENROUTER_FALLBACK_CHAT_MODELS",
            "qwen/qwen3.8-27b:free,google/gemma-4-31b-it:free,openrouter/free",
        )
        or_fallbacks = [
            f"openrouter/{m.strip()}" if not m.strip().startswith("openrouter/") else m.strip()
            for m in or_fallbacks_raw.split(",")
            if m.strip()
        ]
        or_embed = os.environ.get("OPENROUTER_EMBEDDING_MODEL", "nvidia/nemotron-3-embed-1b:free")
        if not or_embed.startswith("openrouter/"):
            or_embed = f"openrouter/{or_embed}"

        if has_openrouter:
            # Free tier OpenRouter routing
            if task in [
                OrchestratorTask.INTENT_ROUTING,
                OrchestratorTask.QUERY_REWRITING,
                OrchestratorTask.CLINICAL_SYNTHESIS,
                OrchestratorTask.EVIDENCE_VERIFICATION,
            ]:
                plan = [
                    {
                        "provider": "openrouter",
                        "model": or_chat,
                        "reason": f"OpenRouter primary free clinical reasoning model ({or_chat}) [Zero Cost]",
                    }
                ]
                for fb in or_fallbacks:
                    plan.append(
                        {
                            "provider": "openrouter",
                            "model": fb,
                            "reason": f"OpenRouter free fallback ({fb}) [Zero Cost]",
                        }
                    )
                plan.append(
                    {
                        "provider": "mock",
                        "model": "mock-clinical-v2",
                        "reason": "Fallback explicit mock if rate-limited",
                    }
                )
                return plan

            elif task == OrchestratorTask.EMBEDDING:
                return [
                    {
                        "provider": "openrouter",
                        "model": or_embed,
                        "reason": f"OpenRouter free embedding model ({or_embed}) [Zero Cost]",
                    },
                    {
                        "provider": "mock",
                        "model": "mock-embedding",
                        "reason": "Deterministic fallback embedding",
                    },
                ]

        # Read user configured defaults or environment for multi-provider setup
        fast_model = os.environ.get("FAST_LLM_MODEL", "gemini/gemini-2.5-flash")
        high_model = os.environ.get("SYNTHESIS_LLM_MODEL", "gemini/gemini-2.5-flash")
        eval_model = os.environ.get("EVALUATOR_LLM_MODEL", "gemini/gemini-2.5-flash")
        embed_model = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")

        if task == OrchestratorTask.INTENT_ROUTING:
            return [
                {"provider": "litellm", "model": fast_model, "reason": "Fast sub-second intent classification"},
                {"provider": "litellm", "model": "openai/gpt-4o-mini", "reason": "Fallback fast router"},
                {"provider": "mock", "model": "mock-clinical-v2", "reason": "Fallback explicit mock"}
            ]

        elif task == OrchestratorTask.QUERY_REWRITING:
            return [
                {"provider": "litellm", "model": fast_model, "reason": "Fast clinical synonym expansion"},
                {"provider": "litellm", "model": "openai/gpt-4o-mini", "reason": "Fallback query rewriter"},
                {"provider": "mock", "model": "mock-clinical-v2", "reason": "Fallback explicit mock"}
            ]

        elif task == OrchestratorTask.CLINICAL_SYNTHESIS:
            return [
                {"provider": "litellm", "model": high_model, "reason": "High-fidelity clinical reasoning & citation grounding"},
                {"provider": "litellm", "model": "openai/gpt-4o", "reason": "High-capability synthesis fallback"},
                {"provider": "litellm", "model": "anthropic/claude-3-5-sonnet-20241022", "reason": "Alternative tier-1 clinical synthesizer"},
                {"provider": "mock", "model": "mock-clinical-v2", "reason": "Fallback explicit mock"}
            ]

        elif task == OrchestratorTask.EVIDENCE_VERIFICATION:
            return [
                {"provider": "litellm", "model": eval_model, "reason": "Independent verification model to audit factual entailment"},
                {"provider": "litellm", "model": "openai/gpt-4o-mini", "reason": "Fallback claim verification"},
                {"provider": "mock", "model": "mock-clinical-v2", "reason": "Fallback explicit mock"}
            ]

        elif task == OrchestratorTask.EMBEDDING:
            return [
                {"provider": "litellm", "model": embed_model, "reason": "Standard dense semantic embedding model"},
                {"provider": "mock", "model": "mock-embedding", "reason": "Deterministic fallback embedding"}
            ]

        # Explicit safety boundary: Deterministic tasks NEVER invoke an LLM
        elif task in [OrchestratorTask.DETERMINISTIC_CALCULATION, OrchestratorTask.DRUG_SAFETY_CHECK]:
            raise ValueError(f"Task '{task.value}' is strictly deterministic and MUST NOT be routed to an LLM.")

        return [{"provider": "mock", "model": "mock-clinical-v2", "reason": "Default fallback"}]

    async def execute_task(
        self,
        task: OrchestratorTask,
        messages: List[LLMMessage],
        temperature: Optional[float] = None,
        max_tokens: int = 2048,
        structured_schema: Optional[Type[BaseModel]] = None
    ) -> LLMResponse:
        """
        Executes an orchestrator task through the routing chain with circuit breakers and fallback.
        """
        routing_candidates = self.get_task_routing_plan(task)
        errors = []
        is_fallback = False

        for idx, candidate in enumerate(routing_candidates):
            provider_name = candidate["provider"]
            model_name = candidate["model"]
            key_id = f"{provider_name}:{model_name}"

            # Check circuit breaker
            if self.circuit_breaker.is_open(key_id):
                continue

            provider = provider_registry.get_provider(provider_name)
            if not provider or not provider.is_available():
                continue

            try:
                temp = temperature if temperature is not None else (0.0 if structured_schema else 0.2)
                start = time.time()

                if structured_schema:
                    structured_result = await provider.generate_structured(
                        messages=messages,
                        model=model_name,
                        schema=structured_schema,
                        temperature=temp
                    )
                    lat = round((time.time() - start) * 1000.0, 2)
                    decision = ModelRoutingDecision(
                        task=task,
                        selected_provider=provider_name,
                        selected_model=model_name,
                        selection_reason=candidate["reason"],
                        latency_ms=lat,
                        fallback_applied=is_fallback,
                        is_mock=(provider_name == "mock"),
                        metadata={"structured": True}
                    )
                    self.execution_decisions.append(decision)
                    self.circuit_breaker.record_success(key_id)
                    return structured_result
                else:
                    response = await provider.generate(
                        messages=messages,
                        model=model_name,
                        temperature=temp,
                        max_tokens=max_tokens
                    )
                    decision = ModelRoutingDecision(
                        task=task,
                        selected_provider=response.provider,
                        selected_model=response.model,
                        selection_reason=candidate["reason"],
                        latency_ms=response.latency_ms,
                        token_usage=response.usage,
                        estimated_cost_usd=response.usage.estimated_cost_usd,
                        fallback_applied=is_fallback,
                        is_mock=response.is_mock
                    )
                    self.execution_decisions.append(decision)
                    self.circuit_breaker.record_success(key_id)
                    return response

            except Exception as e:
                self.circuit_breaker.record_failure(key_id)
                errors.append(f"{key_id}: {str(e)}")
                is_fallback = True
                continue

        # If all candidates failed, raise actionable error
        raise RuntimeError(
            f"All model candidates for task '{task.value}' failed. Errors encountered: {'; '.join(errors)}"
        )

    def route_and_execute(
        self,
        task: OrchestratorTask,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 1024
    ) -> Dict[str, Any]:
        """
        Synchronous routing and execution wrapper for tasks like patient educational synthesis.
        Attempts live model routing via LiteLLM/OpenRouter with graceful fallback.
        """
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt)
        ]

        import asyncio
        import concurrent.futures

        try:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    res = pool.submit(
                        asyncio.run,
                        self.execute_task(task, messages, temperature, max_tokens)
                    ).result(timeout=15.0)
            else:
                res = asyncio.run(self.execute_task(task, messages, temperature, max_tokens))

            return {
                "content": res.content,
                "provider": res.provider,
                "model": res.model,
                "is_mock": getattr(res, "is_mock", False)
            }
        except Exception as e:
            return {"content": "", "error": str(e), "is_mock": True}


model_orchestrator = ModelOrchestrator()
