"""
Configuration settings for Synapse Clinical Copilot backend.
Strictly validated using Pydantic Settings.
"""
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    APP_NAME: str = "Synapse Clinical Copilot"
    APP_VERSION: str = "2.4.0"
    ENVIRONMENT: str = Field(default="development", description="development | staging | production")
    DEBUG: bool = Field(default=False)
    
    # API Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "*"]
    
    # Database
    DATABASE_URL: str = Field(
        default="sqlite:///./synapse_ehr.db",
        description="SQLite local db or PostgreSQL connection string (postgresql://user:pass@host:5432/db)"
    )
    
    # LLM Providers & Keys
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_CHAT_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    OPENROUTER_FALLBACK_CHAT_MODELS: str = "qwen/qwen3.8-27b:free,google/gemma-4-31b-it:free,openrouter/free"
    OPENROUTER_EMBEDDING_MODEL: str = "nvidia/nemotron-3-embed-1b:free"

    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    OLLAMA_BASE_URL: Optional[str] = None

    DEFAULT_LLM_PROVIDER: str = Field(default="openrouter", description="openrouter | mock | gemini | openai")
    FAST_LLM_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    SYNTHESIS_LLM_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    EVALUATOR_LLM_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    EMBEDDING_MODEL: str = "nvidia/nemotron-3-embed-1b:free"
    ROUTER_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    SYNTHESIS_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    
    # Retrieval & Reranker Settings
    EMBEDDING_DIM: int = 384
    TOP_K_RETRIEVAL: int = 4
    RERANK_TOP_N: int = 3
    CRAG_RELEVANCE_THRESHOLD: float = 0.65
    MAX_RETRY_COUNT: int = 2
    
    # Observability
    LANGFUSE_PUBLIC_KEY: Optional[str] = None
    LANGFUSE_SECRET_KEY: Optional[str] = None
    LANGFUSE_HOST: Optional[str] = "https://cloud.langfuse.com"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure os.environ is populated for litellm
import os
if settings.OPENROUTER_API_KEY and not os.environ.get("OPENROUTER_API_KEY"):
    os.environ["OPENROUTER_API_KEY"] = settings.OPENROUTER_API_KEY
if settings.OPENAI_API_KEY and not os.environ.get("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
if settings.GEMINI_API_KEY and not os.environ.get("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
if settings.ANTHROPIC_API_KEY and not os.environ.get("ANTHROPIC_API_KEY"):
    os.environ["ANTHROPIC_API_KEY"] = settings.ANTHROPIC_API_KEY
