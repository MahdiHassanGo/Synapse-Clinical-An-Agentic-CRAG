"""
Knowledge Base Models for Document Ingestion & Chunk Management.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class IngestedDocument(BaseModel):
    doc_id: str
    title: str
    source_organization: str
    publication_date: Optional[str] = "2024"
    version: str = "1.0"
    source_url: Optional[str] = None
    source_type: str  # PDF, HTML, TEXT, FIXTURE
    content_hash: str
    chunk_count: int = 0
    ingestion_timestamp: str
    status: str = "INDEXED"  # PENDING, PROCESSING, INDEXED, FAILED
    is_demo_fixture: bool = False
    access_level: str = "CLINICIAN_ONLY"  # "PATIENT_APPROVED" or "CLINICIAN_ONLY"


class DocumentChunkRecord(BaseModel):
    chunk_id: str
    doc_id: str
    parent_chunk_id: Optional[str] = None
    title: str
    source_organization: str
    section: str
    page_number: Optional[int] = 1
    content: str
    token_count: int = 0
    content_hash: str
    is_demo_fixture: bool = False
    access_level: str = "CLINICIAN_ONLY"  # "PATIENT_APPROVED" or "CLINICIAN_ONLY"
    cross_encoder_score: Optional[float] = None
