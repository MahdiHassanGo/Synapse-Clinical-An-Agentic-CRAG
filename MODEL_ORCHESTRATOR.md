# Model Orchestrator & Multi-Provider Architecture — Synapse Clinical

**Module**: `backend/app/core/orchestrator/` and `backend/app/core/providers/`  
**Abstraction**: LiteLLM Universal Gateway  
**Default Free Tier**: OpenRouter Free Models (`:free`)  

---

## 1. Overview & Architectural Philosophy

Synapse Clinical employs a task-specialized Multi-Model Orchestrator rather than routing all agent steps through a monolithic LLM. High-velocity routing nodes utilize lightweight, fast models; clinical synthesis utilizes high-capacity reasoning models; and all arithmetic calculations and contraindication checks are strictly isolated to deterministic, zero-hallucination Python rule engines.

```
                  ┌──────────────────────────────────────────────┐
                  │           Clinical User Inquiry              │
                  └──────────────────────┬───────────────────────┘
                                         │
                         ┌───────────────▼───────────────┐
                         │   Model Orchestrator Router   │
                         └───────┬───────────────┬───────┘
                                 │               │
        ┌────────────────────────▼───┐       ┌───▼────────────────────────┐
        │   Probabilistic / LLM Tasks │       │     Deterministic Tasks    │
        │   (OrchestratorTask)       │       │     (Zero LLM Permitted)   │
        └────────────┬───────────────┘       └───┬────────────────────────┘
                     │                           │
     ┌───────────────┼───────────────┐           ├── CKD-EPI (2021) eGFR
     │               │               │           ├── Cockcroft-Gault CrCl
┌────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐    ├── Mosteller BSA & BMI
│ Fast Tier │ │ Mid Tier    │ │ Tier 1 Syn. │    └── Pharmacovigilance Rules
│ Routing & │ │ CRAG / NLI  │ │ Clinical    │
│ Reformulat│ │ Relevance   │ │ Synthesis   │
└───────────┘ └─────────────┘ └─────────────┘
```

---

## 2. Task-Specific Routing Matrix

| Task Type (`OrchestratorTask`) | Primary Model | Provider | Fallback Chain | Timeout | Max Cost Budget |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **INTENT_ROUTING** | `nvidia/nemotron-3-ultra-550b-a55b:free` | OpenRouter | `qwen/qwen3.8-27b:free` -> `google/gemma-4-31b-it:free` | 15s | $0.00 / free |
| **TEXT_TO_SQL** | `nvidia/nemotron-3-ultra-550b-a55b:free` | OpenRouter | `qwen/qwen3.8-27b:free` -> `google/gemma-4-31b-it:free` | 20s | $0.00 / free |
| **CRAG_EVALUATION** | `nvidia/nemotron-3-ultra-550b-a55b:free` | OpenRouter | `qwen/qwen3.8-27b:free` -> `google/gemma-4-31b-it:free` | 20s | $0.00 / free |
| **QUERY_REWRITING** | `nvidia/nemotron-3-ultra-550b-a55b:free` | OpenRouter | `qwen/qwen3.8-27b:free` -> `google/gemma-4-31b-it:free` | 15s | $0.00 / free |
| **CLINICAL_SYNTHESIS** | `nvidia/nemotron-3-ultra-550b-a55b:free` | OpenRouter | `qwen/qwen3.8-27b:free` -> `google/gemma-4-31b-it:free` | 30s | $0.00 / free |
| **CLAIM_EXTRACTION** | `nvidia/nemotron-3-ultra-550b-a55b:free` | OpenRouter | `qwen/qwen3.8-27b:free` -> `google/gemma-4-31b-it:free` | 20s | $0.00 / free |
| **DETERMINISTIC_CALCULATION** | **Pure Python Formula** | Deterministic Engine | *None (Zero LLM Permitted)* | < 1ms | $0.0000 |
| **DRUG_SAFETY_CHECK** | **Deterministic Rules** | Rule Engine | *None (Zero LLM Permitted)* | < 1ms | $0.0000 |

---

## 3. Deterministic Task Guardrails (Poteto Pyramid Rule 1)

In clinical triage, arithmetic errors and missed drug-drug interactions can cause catastrophic harm. The `ModelOrchestrator` implements hard architectural constraints in `backend/app/core/orchestrator/orchestrator.py`:

```python
def get_task_routing_plan(self, task: OrchestratorTask) -> TaskRoutingPolicy:
    if task in [OrchestratorTask.DETERMINISTIC_CALCULATION, OrchestratorTask.DRUG_SAFETY_CHECK]:
        raise ValueError(
            f"Regulatory & Clinical Guardrail: Task {task.value} cannot be dispatched to an LLM. "
            "Must be executed strictly via deterministic Python engines."
        )
    ...
```

Any attempt by a subagent or workflow node to route clinical formulas or contraindications to an LLM is intercepted and blocked deterministically at the type boundary.

---

## 4. Circuit Breaker & Failover Protocol

To guarantee high availability without stalling clinical workflows, the orchestrator incorporates a stateful `CircuitBreaker`:

- **Failure Threshold**: 2 consecutive network or API exceptions trips the circuit for that model.
- **Cooldown Window**: 60 seconds of silent standby before a trial probe is allowed.
- **Failover Sequence**: When a primary model fails or trips the breaker, the orchestrator automatically cascades down the `fallback_chain` to the next configured model.
- **Explicit Visibility**: Fallback decisions, provider switches, and circuit states are logged in `state["model_routing_decisions"]` and rendered live in the telemetry stream.

---

## 5. Token Accounting & Cost Estimation

Every completion call tracks:
- Prompt Tokens
- Completion Tokens
- Total Tokens
- Wall-Clock Latency (ms)
- Estimated Cost (USD) based on LiteLLM cost tables

When using OpenRouter Free models, cost calculations reflect $0.0000/token with complete usage transparency.
