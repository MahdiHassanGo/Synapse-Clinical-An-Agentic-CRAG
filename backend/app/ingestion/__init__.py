"""Knowledge Base Ingestion Package."""
from app.ingestion.models import IngestedDocument, DocumentChunkRecord
from app.ingestion.manager import knowledge_base_manager

__all__ = ["IngestedDocument", "DocumentChunkRecord", "knowledge_base_manager"]
