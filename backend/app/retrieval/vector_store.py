"""
Persistent Vector Store for Synapse Clinical.
Supports:
1. PostgreSQL 16 + pgvector with connection pooling and HNSW index (Production).
2. SQLite embedded database with exact cosine similarity (Local Dev / Isolated Tests).
3. Automatic schema initialization, migrations, and stable SHA-256 chunk identifiers.
"""
import os
import json
import sqlite3
import logging
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger("synapse.vector_store")


class VectorStore:
    def __init__(self, db_path: Optional[str] = None):
        self.is_postgres = False
        self.pg_pool = None
        self.db_path = db_path or "./synapse_ehr.db"
        self._init_backend()

    def _init_backend(self):
        db_url = os.environ.get("DATABASE_URL", settings.DATABASE_URL)
        if db_url.startswith("postgresql://") or db_url.startswith("postgres://"):
            try:
                import psycopg2
                from psycopg2.pool import SimpleConnectionPool
                from pgvector.psycopg2 import register_vector

                self.pg_pool = SimpleConnectionPool(1, 10, dsn=db_url)
                conn = self.pg_pool.getconn()
                conn.autocommit = True
                with conn.cursor() as cur:
                    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                    cur.execute("""
                    CREATE TABLE IF NOT EXISTS knowledge_documents (
                        doc_id VARCHAR(100) PRIMARY KEY,
                        title VARCHAR(255) NOT NULL,
                        source_organization VARCHAR(255) NOT NULL,
                        publication_date VARCHAR(50),
                        version VARCHAR(50) DEFAULT '1.0',
                        source_url TEXT,
                        source_type VARCHAR(50) NOT NULL,
                        content_hash VARCHAR(100) NOT NULL,
                        chunk_count INTEGER DEFAULT 0,
                        ingestion_timestamp VARCHAR(50) NOT NULL,
                        status VARCHAR(50) NOT NULL,
                        is_demo_fixture BOOLEAN DEFAULT FALSE,
                        access_level VARCHAR(50) DEFAULT 'CLINICIAN_ONLY'
                    );
                    """)
                    cur.execute("""
                    CREATE TABLE IF NOT EXISTS knowledge_chunks (
                        chunk_id VARCHAR(150) PRIMARY KEY,
                        doc_id VARCHAR(100) NOT NULL REFERENCES knowledge_documents(doc_id) ON DELETE CASCADE,
                        parent_chunk_id VARCHAR(150),
                        title VARCHAR(255) NOT NULL,
                        source_organization VARCHAR(255) NOT NULL,
                        section VARCHAR(255) NOT NULL,
                        page_number INTEGER,
                        content TEXT NOT NULL,
                        token_count INTEGER,
                        content_hash VARCHAR(100) NOT NULL,
                        embedding vector(384),
                        is_demo_fixture BOOLEAN DEFAULT FALSE,
                        access_level VARCHAR(50) DEFAULT 'CLINICIAN_ONLY'
                    );
                    """)
                    # Create HNSW cosine index
                    cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw 
                    ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
                    """)
                register_vector(conn)
                self.pg_pool.putconn(conn)
                self.is_postgres = True
                logger.info("VectorStore connected to PostgreSQL with pgvector extension enabled.")
                return
            except Exception as e:
                logger.warning(f"PostgreSQL connection failed ({e}). Falling back to SQLite vector store.")
                self.is_postgres = False

        # SQLite Fallback
        self._init_sqlite_tables()

    def _init_sqlite_tables(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_documents (
            doc_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            source_organization TEXT NOT NULL,
            publication_date TEXT,
            version TEXT DEFAULT '1.0',
            source_url TEXT,
            source_type TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            chunk_count INTEGER DEFAULT 0,
            ingestion_timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            is_demo_fixture BOOLEAN DEFAULT 0,
            access_level TEXT DEFAULT 'CLINICIAN_ONLY'
        );
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
            chunk_id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL,
            parent_chunk_id TEXT,
            title TEXT NOT NULL,
            source_organization TEXT NOT NULL,
            section TEXT NOT NULL,
            page_number INTEGER,
            content TEXT NOT NULL,
            token_count INTEGER,
            content_hash TEXT NOT NULL,
            embedding_json TEXT,
            is_demo_fixture BOOLEAN DEFAULT 0,
            access_level TEXT DEFAULT 'CLINICIAN_ONLY',
            FOREIGN KEY(doc_id) REFERENCES knowledge_documents(doc_id) ON DELETE CASCADE
        );
        """)
        # Backward-compatible migrations for existing local databases
        for col_stmt in [
            "ALTER TABLE knowledge_documents ADD COLUMN access_level TEXT DEFAULT 'CLINICIAN_ONLY'",
            "ALTER TABLE knowledge_chunks ADD COLUMN access_level TEXT DEFAULT 'CLINICIAN_ONLY'",
        ]:
            try:
                cursor.execute(col_stmt)
            except sqlite3.OperationalError:
                pass
        conn.commit()
        conn.close()

    def _get_sqlite_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def store_document(self, doc: Dict[str, Any]):
        access_level = doc.get("access_level", "CLINICIAN_ONLY")
        if self.is_postgres and self.pg_pool:
            conn = self.pg_pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                    INSERT INTO knowledge_documents (
                        doc_id, title, source_organization, publication_date,
                        version, source_url, source_type, content_hash,
                        chunk_count, ingestion_timestamp, status, is_demo_fixture, access_level
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (doc_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        chunk_count = EXCLUDED.chunk_count,
                        status = EXCLUDED.status,
                        access_level = EXCLUDED.access_level;
                    """, (
                        doc["doc_id"], doc["title"], doc.get("source_organization", "Medical Authority"),
                        doc.get("publication_date", "2024"), doc.get("version", "1.0"),
                        doc.get("source_url", ""), doc.get("source_type", "TEXT"),
                        doc.get("content_hash", ""), doc.get("chunk_count", 0),
                        doc.get("ingestion_timestamp", ""), doc.get("status", "INDEXED"),
                        bool(doc.get("is_demo_fixture")), access_level
                    ))
                conn.commit()
            finally:
                self.pg_pool.putconn(conn)
            return

        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT OR REPLACE INTO knowledge_documents (
            doc_id, title, source_organization, publication_date,
            version, source_url, source_type, content_hash,
            chunk_count, ingestion_timestamp, status, is_demo_fixture, access_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            doc["doc_id"], doc["title"], doc.get("source_organization", "Medical Authority"),
            doc.get("publication_date", "2024"), doc.get("version", "1.0"),
            doc.get("source_url", ""), doc.get("source_type", "TEXT"),
            doc.get("content_hash", ""), doc.get("chunk_count", 0),
            doc.get("ingestion_timestamp", ""), doc.get("status", "INDEXED"),
            1 if doc.get("is_demo_fixture") else 0, access_level
        ))
        conn.commit()
        conn.close()

    def store_chunks(self, chunks: List[Dict[str, Any]]):
        if not chunks:
            return

        if self.is_postgres and self.pg_pool:
            conn = self.pg_pool.getconn()
            try:
                with conn.cursor() as cur:
                    for c in chunks:
                        emb = c.get("embedding")
                        acc = c.get("access_level", "CLINICIAN_ONLY")
                        cur.execute("""
                        INSERT INTO knowledge_chunks (
                            chunk_id, doc_id, parent_chunk_id, title,
                            source_organization, section, page_number,
                            content, token_count, content_hash, embedding, is_demo_fixture, access_level
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (chunk_id) DO UPDATE SET
                            content = EXCLUDED.content,
                            embedding = EXCLUDED.embedding,
                            access_level = EXCLUDED.access_level;
                        """, (
                            c["chunk_id"], c["doc_id"], c.get("parent_chunk_id"),
                            c["title"], c.get("source_organization", "Medical Authority"),
                            c.get("section", "General"), c.get("page_number", 1),
                            c["content"], c.get("token_count", len(c["content"].split())),
                            c.get("content_hash", ""), emb, bool(c.get("is_demo_fixture")), acc
                        ))
                conn.commit()
            finally:
                self.pg_pool.putconn(conn)
            return

        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        for c in chunks:
            emb_json = json.dumps(c.get("embedding")) if c.get("embedding") is not None else None
            acc = c.get("access_level", "CLINICIAN_ONLY")
            cursor.execute("""
            INSERT OR REPLACE INTO knowledge_chunks (
                chunk_id, doc_id, parent_chunk_id, title,
                source_organization, section, page_number,
                content, token_count, content_hash, embedding_json, is_demo_fixture, access_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                c["chunk_id"], c["doc_id"], c.get("parent_chunk_id"),
                c["title"], c.get("source_organization", "Medical Authority"),
                c.get("section", "General"), c.get("page_number", 1),
                c["content"], c.get("token_count", len(c["content"].split())),
                c.get("content_hash", ""), emb_json,
                1 if c.get("is_demo_fixture") else 0, acc
            ))
        conn.commit()
        conn.close()

    def search_dense(
        self,
        query_vector: Optional[List[float]],
        top_k: int = 20,
        access_level: Optional[str] = None
    ) -> List[Tuple[float, Dict[str, Any]]]:
        """
        Executes dense semantic cosine retrieval:
        1. On PostgreSQL: Uses pgvector cosine operator `<=>` via HNSW index.
        2. On SQLite: Computes exact cosine similarity via numpy.
        Optionally filters by access_level ('PATIENT_APPROVED' or 'CLINICIAN_ONLY').
        """
        if query_vector is None or len(query_vector) == 0:
            return []

        if self.is_postgres and self.pg_pool:
            conn = self.pg_pool.getconn()
            try:
                with conn.cursor() as cur:
                    if access_level:
                        cur.execute("""
                        SELECT chunk_id, doc_id, parent_chunk_id, title, source_organization,
                               section, page_number, content, token_count, content_hash,
                               1 - (embedding <=> %s::vector) AS similarity, access_level
                        FROM knowledge_chunks
                        WHERE embedding IS NOT NULL AND access_level = %s
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s;
                        """, (query_vector, access_level, query_vector, top_k))
                    else:
                        cur.execute("""
                        SELECT chunk_id, doc_id, parent_chunk_id, title, source_organization,
                               section, page_number, content, token_count, content_hash,
                               1 - (embedding <=> %s::vector) AS similarity, access_level
                        FROM knowledge_chunks
                        WHERE embedding IS NOT NULL
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s;
                        """, (query_vector, query_vector, top_k))
                    rows = cur.fetchall()
                    results = []
                    for r in rows:
                        chunk_dict = {
                            "chunk_id": r[0], "doc_id": r[1], "parent_chunk_id": r[2],
                            "title": r[3], "source_organization": r[4], "section": r[5],
                            "page_number": r[6], "content": r[7], "token_count": r[8],
                            "content_hash": r[9], "access_level": r[11] if len(r) > 11 else "CLINICIAN_ONLY"
                        }
                        sim = float(r[10]) if r[10] is not None else 0.0
                        results.append((sim, chunk_dict))
                    return results
            finally:
                self.pg_pool.putconn(conn)

        # SQLite implementation
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM knowledge_chunks WHERE embedding_json IS NOT NULL")
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            return []

        q_vec = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []
        q_vec /= q_norm

        scored: List[Tuple[float, Dict[str, Any]]] = []
        for r in rows:
            d = dict(r)
            if access_level and d.get("access_level") != access_level:
                continue
            if not d.get("embedding_json"):
                continue
            emb = np.array(json.loads(d["embedding_json"]), dtype=np.float32)
            emb_norm = np.linalg.norm(emb)
            if emb_norm > 0:
                emb /= emb_norm
            similarity = float(np.dot(q_vec, emb))
            scored.append((similarity, d))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[:top_k]

    def list_documents(self) -> List[Dict[str, Any]]:
        if self.is_postgres and self.pg_pool:
            conn = self.pg_pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT * FROM knowledge_documents ORDER BY ingestion_timestamp DESC;")
                    colnames = [desc[0] for desc in cur.description]
                    return [dict(zip(colnames, row)) for row in cur.fetchall()]
            finally:
                self.pg_pool.putconn(conn)

        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM knowledge_documents ORDER BY ingestion_timestamp DESC")
        docs = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return docs

    def get_document_chunks(self, doc_id: str) -> List[Dict[str, Any]]:
        if self.is_postgres and self.pg_pool:
            conn = self.pg_pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT * FROM knowledge_chunks WHERE doc_id = %s;", (doc_id,))
                    colnames = [desc[0] for desc in cur.description]
                    return [dict(zip(colnames, row)) for row in cur.fetchall()]
            finally:
                self.pg_pool.putconn(conn)

        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM knowledge_chunks WHERE doc_id = ?", (doc_id,))
        chunks = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return chunks

    def delete_document(self, doc_id: str) -> bool:
        if self.is_postgres and self.pg_pool:
            conn = self.pg_pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM knowledge_chunks WHERE doc_id = %s;", (doc_id,))
                    cur.execute("DELETE FROM knowledge_documents WHERE doc_id = %s;", (doc_id,))
                conn.commit()
                return True
            finally:
                self.pg_pool.putconn(conn)

        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM knowledge_chunks WHERE doc_id = ?", (doc_id,))
        cursor.execute("DELETE FROM knowledge_documents WHERE doc_id = ?", (doc_id,))
        conn.commit()
        conn.close()
        return True


vector_store = VectorStore()
