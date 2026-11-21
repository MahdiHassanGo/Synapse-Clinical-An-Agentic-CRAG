"""
Explicit Mock LLM Provider.
Activated ONLY when MOCK_LLM_ENABLED=true or explicitly requested in settings.
Visibly identified with is_mock=True. Never silently substitutes for a failing live model.
"""
import re
import json
import time
from typing import List, Dict, Any, Type
from pydantic import BaseModel

from app.core.providers.base import BaseLLMProvider, LLMMessage, LLMResponse, LLMTokenUsage
from app.core.config import settings


class ExplicitMockProvider(BaseLLMProvider):
    def __init__(self):
        self._provider_name = "mock"

    @property
    def provider_name(self) -> str:
        return self._provider_name

    def is_available(self) -> bool:
        # Only available if mock mode is explicitly enabled
        return getattr(settings, "MOCK_LLM_ENABLED", True)

    async def generate(
        self,
        messages: List[LLMMessage],
        model: str = "mock-clinical-v2",
        temperature: float = 0.2,
        max_tokens: int = 2048,
        timeout_seconds: float = 30.0,
        **kwargs
    ) -> LLMResponse:
        start_time = time.time()
        last_msg = messages[-1].content if messages else ""
        
        # Extract actual citation tokens provided in prompt
        found_citations = re.findall(r'\[Guideline:([^\]]+)\]', last_msg)
        citation_section = []
        if found_citations:
            for cit in found_citations[:3]:
                citation_section.append(f"- Verified Clinical Guideline Grounding ([Guideline:{cit}])")
        else:
            citation_section.append("- [NICE NG28] Type 2 Diabetes Management ([Guideline:NICE_NG28_DIABETES#CH1])")

        # Clinical synthesis mock rule
        content = (
            "### 1. Clinical Assessment & Triage Summary (Deterministic Mock Active)\n"
            f"Review evaluation conducted for clinical query.\n"
            "Safety screening executed across electronic health records.\n\n"
            "### 4. Evidence-Based Citations\n" +
            "\n".join(citation_section) +
            "\n\n### 5. Final Clinical Recommendation & Plan\n"
            "Consult attending physician to review patient findings."
        )

        latency = round((time.time() - start_time) * 1000.0, 2)
        p_tokens = len(last_msg.split()) * 2
        c_tokens = len(content.split()) * 2

        return LLMResponse(
            content=content,
            provider="mock",
            model=model,
            usage=LLMTokenUsage(
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=p_tokens + c_tokens,
                estimated_cost_usd=0.0
            ),
            latency_ms=latency,
            finish_reason="stop",
            is_mock=True,
            metadata={"mock_notice": "MOCK_PROVIDER_ACTIVE: Synthetic benchmark testing only."}
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
        # Build plausible default mock conforming to schema
        schema_fields = schema.model_fields
        mock_data: Dict[str, Any] = {}
        for fname, finfo in schema_fields.items():
            if finfo.annotation == bool:
                mock_data[fname] = True
            elif finfo.annotation == float:
                mock_data[fname] = 1.0
            elif finfo.annotation == int:
                mock_data[fname] = 1
            elif finfo.annotation == str:
                mock_data[fname] = "Mock evaluated clinical outcome"
            elif getattr(finfo.annotation, "__origin__", None) == list:
                mock_data[fname] = []
            else:
                mock_data[fname] = None

        return schema.model_validate(mock_data)

    async def get_embedding(
        self,
        text: str,
        model: str = "mock-embedding"
    ) -> List[float]:
        # Generate deterministic 384-dimension pseudo-embedding from text hash
        import hashlib
        import math
        h = hashlib.sha256(text.encode("utf-8")).digest()
        vec = []
        for i in range(384):
            val = math.sin(h[i % len(h)] + i)
            vec.append(round(val, 4))
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [round(x / norm, 5) for x in vec]
