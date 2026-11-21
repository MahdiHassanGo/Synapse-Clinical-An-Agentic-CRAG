"""
Genuine Semantic Embedding Engine for Synapse Clinical.
Supports:
1. Local Sentence-Transformers (e.g. BAAI/bge-small-en-v1.5, all-MiniLM-L6-v2).
2. Remote API Embeddings via LiteLLM (OpenRouter / OpenAI).
3. Explicit availability status — NEVER silently falls back to pseudo-hash vectors.
"""
import os
import logging
from typing import List, Optional

# Ensure HuggingFace cache directory is writable
try:
    hf_home = os.environ.get("HF_HOME", "")
    if not hf_home or not os.path.exists(os.path.dirname(hf_home)) or not os.access(os.path.dirname(hf_home), os.W_OK):
        safe_cache = os.path.expanduser("~/.cache/huggingface")
        os.makedirs(safe_cache, exist_ok=True)
        os.environ["HF_HOME"] = safe_cache
        os.environ["TRANSFORMERS_CACHE"] = os.path.join(safe_cache, "transformers")
except Exception:
    pass

logger = logging.getLogger("synapse.embeddings")


class EmbeddingEngine:
    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        self._local_model = None
        self._is_available = False
        self._init_engine()

    def _init_engine(self):
        """Attempts to load SentenceTransformer for local zero-latency dense embeddings."""
        try:
            from sentence_transformers import SentenceTransformer
            # Fast, reliable standard medical/general sentence transformer
            local_target = self.model_name
            if "bge" in local_target.lower() or "minilm" in local_target.lower():
                self._local_model = SentenceTransformer(local_target)
            else:
                self._local_model = SentenceTransformer("all-MiniLM-L6-v2")
            self._is_available = True
            logger.info("Local SentenceTransformer embedding engine initialized successfully.")
        except Exception as e:
            logger.warning(f"SentenceTransformer not loaded ({e}). Checking remote embedding API...")
            if os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENROUTER_API_KEY"):
                self._is_available = True
            else:
                self._is_available = False

    @property
    def is_available(self) -> bool:
        return self._is_available

    @property
    def dimension(self) -> int:
        return 384

    def embed_text(self, text: str) -> Optional[List[float]]:
        return self.generate_embedding(text)

    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generates a genuine 384-dimensional dense semantic vector.
        Returns None if no real embedding engine is configured (dense retrieval unavailable).
        """
        if not text or not text.strip():
            return None

        # 1. Local SentenceTransformer inference
        if self._local_model is not None:
            try:
                emb = self._local_model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
                return [round(float(x), 5) for x in emb.tolist()]
            except Exception as e:
                logger.error(f"Local embedding generation failed: {e}")

        # 2. Remote LiteLLM embedding fallback if configured
        if os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENROUTER_API_KEY"):
            try:
                import litellm
                model = os.environ.get("OPENROUTER_EMBEDDING_MODEL") or "text-embedding-3-small"
                resp = litellm.embedding(model=model, input=[text])
                if resp and "data" in resp and len(resp["data"]) > 0:
                    vec = resp["data"][0]["embedding"]
                    # Take first 384 dimensions if larger, or return normalized
                    return [round(float(x), 5) for x in vec[:384]]
            except Exception as e:
                logger.warning(f"Remote embedding API call failed: {e}")

        return None

    def generate_embedding_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Batch embedding generation for efficient ingestion."""
        if self._local_model is not None:
            try:
                embs = self._local_model.encode(texts, convert_to_numpy=True, normalize_embeddings=True, batch_size=32)
                return [[round(float(x), 5) for x in row.tolist()] for row in embs]
            except Exception as e:
                logger.error(f"Batch embedding generation failed: {e}")

        return [self.generate_embedding(t) for t in texts]


embedding_engine = EmbeddingEngine()
