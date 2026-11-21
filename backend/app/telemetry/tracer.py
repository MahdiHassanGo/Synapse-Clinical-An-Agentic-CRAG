"""
Execution Tracer and Observability for Synapse Clinical Copilot.
Tracks step-by-step agent execution, latency in milliseconds,
and generates structured traces compatible with Langfuse and Arize Phoenix.
"""
import time
from typing import List, Dict, Any, Optional
from app.core.models import AgentExecutionStep


class AgentTracer:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.start_time = time.time()
        self.steps: List[AgentExecutionStep] = []
        self._active_spans: Dict[str, float] = {}

    def start_step(self, step_name: str, description: str, metadata: Optional[Dict[str, Any]] = None) -> AgentExecutionStep:
        self._active_spans[step_name] = time.time()
        step = AgentExecutionStep(
            step_name=step_name,
            description=description,
            status="IN_PROGRESS",
            latency_ms=0.0,
            metadata=metadata or {}
        )
        self.steps.append(step)
        return step

    def complete_step(self, step_name: str, metadata: Optional[Dict[str, Any]] = None, status: str = "COMPLETED"):
        start = self._active_spans.pop(step_name, time.time())
        duration_ms = round((time.time() - start) * 1000.0, 2)

        for step in reversed(self.steps):
            if step.step_name == step_name:
                step.status = status
                step.latency_ms = duration_ms
                if metadata:
                    step.metadata.update(metadata)
                break

    def get_total_latency_ms(self) -> float:
        return round((time.time() - self.start_time) * 1000.0, 2)

    def export_trace_summary(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "total_latency_ms": self.get_total_latency_ms(),
            "step_count": len(self.steps),
            "steps": [s.model_dump() for s in self.steps]
        }
