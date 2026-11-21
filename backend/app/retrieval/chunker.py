"""
Hierarchical Parent-Child Chunking Engine.
Splits clinical guidelines into:
- Parent Chunks (Full clinical section, 600-1200 chars): Retains complete therapeutic context, evidence grades, and clinical rationale.
- Child Chunks (Actionable recommendation statement, 150-350 chars): Optimized for dense and sparse keyword matching.

Maintains strict two-way linkage so retrieved child chunks immediately hydrate with parent context.
"""
from typing import List, Dict, Tuple
from app.core.models import GuidelineChunk


class HierarchicalChunker:
    def __init__(self, child_chunk_size: int = 300, child_overlap: int = 60):
        self.child_chunk_size = child_chunk_size
        self.child_overlap = child_overlap

    def chunk_guideline(
        self,
        doc_id: str,
        title: str,
        source_organization: str,
        section_name: str,
        full_text: str
    ) -> Tuple[GuidelineChunk, List[GuidelineChunk]]:
        """
        Creates one parent chunk representing the full section and multiple child chunks linked to it.
        """
        parent_chunk_id = f"{doc_id}_P_{abs(hash(section_name)) % 10000}"
        
        parent_chunk = GuidelineChunk(
            chunk_id=parent_chunk_id,
            doc_id=doc_id,
            title=title,
            source_organization=source_organization,
            section=section_name,
            content=full_text.strip(),
            parent_chunk_id=None
        )

        # Generate child chunks using sliding sentence/character window
        sentences = [s.strip() for s in full_text.split(". ") if s.strip()]
        child_chunks: List[GuidelineChunk] = []
        
        current_child_text = ""
        child_idx = 1

        for sentence in sentences:
            sentence_with_dot = sentence if sentence.endswith(".") else sentence + "."
            if len(current_child_text) + len(sentence_with_dot) > self.child_chunk_size and current_child_text:
                child_id = f"{parent_chunk_id}_C{child_idx}"
                child_chunks.append(GuidelineChunk(
                    chunk_id=child_id,
                    doc_id=doc_id,
                    title=title,
                    source_organization=source_organization,
                    section=section_name,
                    content=current_child_text.strip(),
                    parent_chunk_id=parent_chunk_id
                ))
                child_idx += 1
                # Overlap: keep tail sentence
                current_child_text = sentence_with_dot
            else:
                if current_child_text:
                    current_child_text += " " + sentence_with_dot
                else:
                    current_child_text = sentence_with_dot

        if current_child_text:
            child_id = f"{parent_chunk_id}_C{child_idx}"
            child_chunks.append(GuidelineChunk(
                chunk_id=child_id,
                doc_id=doc_id,
                title=title,
                source_organization=source_organization,
                section=section_name,
                content=current_child_text.strip(),
                parent_chunk_id=parent_chunk_id
            ))

        return parent_chunk, child_chunks


hierarchical_chunker = HierarchicalChunker()
