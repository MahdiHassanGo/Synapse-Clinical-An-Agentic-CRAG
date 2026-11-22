"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Upload,
  Globe,
  Trash2,
  Eye,
  FileText,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  X,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface KnowledgeDoc {
  doc_id: string;
  title: string;
  source_organization: string;
  publication_date: string;
  source_url?: string;
  source_hash: string;
  section_count?: number;
  chunk_count?: number;
  ingestion_timestamp?: string;
  status?: string;
  access_level?: string;
}

interface ChunkRecord {
  chunk_id: string;
  parent_id?: string;
  parent_chunk_id?: string;
  doc_id: string;
  section: string;
  chunk_index: number;
  content: string;
  token_count: number;
  content_hash: string;
  access_level?: string;
}

export function KnowledgeBaseView() {
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");

  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [organization, setOrganization] = useState<string>("NICE");
  const [pubDate, setPubDate] = useState<string>("2024");
  const [url, setUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // Chunk inspection state
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [inspectChunks, setInspectChunks] = useState<ChunkRecord[]>([]);
  const [loadingChunks, setLoadingChunks] = useState<boolean>(false);

  // Load documents
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/knowledge/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to load knowledge documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Inspect chunks of a doc
  const handleInspect = async (docId: string) => {
    setSelectedDocId(docId);
    setLoadingChunks(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/knowledge/documents/${docId}`);
      if (res.ok) {
        const data = await res.json();
        setInspectChunks(data.chunks || []);
      }
    } catch (err) {
      console.error("Failed to load chunks", err);
    } finally {
      setLoadingChunks(false);
    }
  };

  // Delete document
  const handleDelete = async (docId: string) => {
    if (!confirm(`Are you sure you want to delete document ${docId}?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/knowledge/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedback({ type: "success", message: `Document ${docId} deleted successfully.` });
        if (selectedDocId === docId) setSelectedDocId(null);
        loadDocuments();
      }
    } catch (err) {
      setFeedback({ type: "error", message: `Failed to delete document: ${err}` });
    }
  };

  // Ingest PDF
  const handleUploadPDF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) {
      setFeedback({ type: "error", message: "Please select a PDF file and provide a title." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("organization", organization);
    formData.append("publication_date", pubDate);

    try {
      const res = await fetch(`${BACKEND_URL}/api/knowledge/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setFeedback({ type: "success", message: "PDF successfully parsed, chunked, and indexed!" });
        setFile(null);
        setTitle("");
        loadDocuments();
      } else {
        const err = await res.json();
        setFeedback({ type: "error", message: err.detail || "Upload failed." });
      }
    } catch (err) {
      setFeedback({ type: "error", message: `Network error: ${err}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ingest URL
  const handleIngestURL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim()) {
      setFeedback({ type: "error", message: "Please provide a valid URL and title." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/knowledge/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title, organization }),
      });
      if (res.ok) {
        setFeedback({ type: "success", message: "URL guideline successfully ingested & indexed!" });
        setUrl("");
        setTitle("");
        loadDocuments();
      } else {
        const err = await res.json();
        setFeedback({ type: "error", message: err.detail || "URL ingestion failed." });
      }
    } catch (err) {
      setFeedback({ type: "error", message: `Network error: ${err}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count ?? d.section_count ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full font-sans">
      {/* Title & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-clinical-blue" />
            <span>Clinical Knowledge Base & Document Ingestion</span>
          </h1>
          <p className="text-xs text-graphite-400 mt-1">
            Hierarchical parent-child chunking with dense vector indexing and BM25 hybrid storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-graphite-900 border border-white/[0.08] text-right">
            <span className="text-[10px] uppercase font-mono text-graphite-500 block">
              Verified Documents
            </span>
            <span className="text-sm font-bold font-mono text-white tabular-nums">
              {documents.length}
            </span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-graphite-900 border border-white/[0.08] text-right">
            <span className="text-[10px] uppercase font-mono text-graphite-500 block">
              Total Chunks
            </span>
            <span className="text-sm font-bold font-mono text-clinical-teal tabular-nums">
              {totalChunks}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-clinical-emerald/10 border-clinical-emerald/30 text-clinical-emerald"
              : "bg-clinical-rose/10 border-clinical-rose/30 text-clinical-rose"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Ingestion Panels (PDF or URL) */}
      <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <span className="text-xs font-semibold text-white">Ingest New Clinical Protocol</span>
          <div className="flex items-center gap-1 bg-graphite-850 p-1 rounded-lg border border-white/[0.06]">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "upload"
                  ? "bg-graphite-750 text-white"
                  : "text-graphite-400 hover:text-white"
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>PDF Document</span>
            </button>
            <button
              onClick={() => setActiveTab("url")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "url"
                  ? "bg-graphite-750 text-white"
                  : "text-graphite-400 hover:text-white"
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Official URL / HTML</span>
            </button>
          </div>
        </div>

        {activeTab === "upload" ? (
          <form onSubmit={handleUploadPDF} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-graphite-400 block mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. NICE NG28 Type 2 Diabetes"
                  className="w-full bg-graphite-850 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-graphite-500 focus:outline-none focus:border-clinical-blue"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-graphite-400 block mb-1">
                  Issuing Authority
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="NICE, KDIGO, WHO, BMDC"
                  className="w-full bg-graphite-850 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-graphite-500 focus:outline-none focus:border-clinical-blue"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-graphite-400 block mb-1">
                  Publication Year
                </label>
                <input
                  type="text"
                  value={pubDate}
                  onChange={(e) => setPubDate(e.target.value)}
                  placeholder="2024"
                  className="w-full bg-graphite-850 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-graphite-500 focus:outline-none focus:border-clinical-blue"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-graphite-400 block mb-1">
                Select PDF File
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full bg-graphite-850 border border-white/[0.08] rounded-xl p-2 text-xs text-graphite-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-graphite-750 file:text-white hover:file:bg-graphite-700 cursor-pointer"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-clinical-blue hover:bg-clinical-blue/90 text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Ingesting & Chunking..." : "Upload & Index PDF"}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleIngestURL} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-graphite-400 block mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. KDIGO 2024 Clinical Practice Guideline"
                  className="w-full bg-graphite-850 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-graphite-500 focus:outline-none focus:border-clinical-blue"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-graphite-400 block mb-1">
                  Issuing Organization
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="WHO, NICE, KDIGO"
                  className="w-full bg-graphite-850 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-graphite-500 focus:outline-none focus:border-clinical-blue"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-graphite-400 block mb-1">
                Official Guideline URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.nice.org.uk/guidance/ng28"
                className="w-full bg-graphite-850 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-graphite-500 focus:outline-none focus:border-clinical-blue"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-clinical-blue hover:bg-clinical-blue/90 text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Scraping & Indexing..." : "Fetch & Ingest URL"}</span>
            </button>
          </form>
        )}
      </div>

      {/* Ingested Documents Table */}
      <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <span className="text-xs font-semibold text-white">
            Ingested Clinical Guidelines & Protocols
          </span>
          <span className="text-[11px] font-mono text-graphite-400">
            {documents.length} guidelines stored in pgvector
          </span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-graphite-400 font-mono">
            Loading knowledge documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-xs text-graphite-400">
            No clinical guidelines ingested yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-graphite-400 font-mono text-[11px]">
                  <th className="pb-2.5 font-normal">Document UID</th>
                  <th className="pb-2.5 font-normal">Title & Authority</th>
                  <th className="pb-2.5 font-normal">Access Policy</th>
                  <th className="pb-2.5 font-normal">Sections</th>
                  <th className="pb-2.5 font-normal">Chunks</th>
                  <th className="pb-2.5 font-normal">Indexed</th>
                  <th className="pb-2.5 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {documents.map((doc) => (
                  <tr key={doc.doc_id} className="hover:bg-white/[0.01]">
                    <td className="py-3 font-mono text-[11px] text-clinical-blue">
                      {doc.doc_id}
                    </td>
                    <td className="py-3">
                      <div className="font-medium text-white">{doc.title}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-graphite-400">
                        <span className="px-1.5 py-0.2 rounded bg-graphite-800 text-graphite-300 border border-white/[0.04]">
                          {doc.source_organization}
                        </span>
                        <span>{doc.publication_date}</span>
                        {doc.source_url && (
                          <a
                            href={doc.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-clinical-blue hover:underline inline-flex items-center gap-0.5"
                          >
                            <span>source</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3 font-mono">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-medium ${
                          doc.access_level === "PATIENT_APPROVED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/20"
                        }`}
                      >
                        {doc.access_level || "CLINICIAN_ONLY"}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-graphite-300 tabular-nums">
                      {doc.section_count ?? doc.chunk_count ?? 0}
                    </td>
                    <td className="py-3 font-mono text-clinical-teal font-semibold tabular-nums">
                      {doc.chunk_count ?? doc.section_count ?? 0}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-graphite-400">
                      {doc.ingestion_timestamp}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        onClick={() => handleInspect(doc.doc_id)}
                        className="px-2.5 py-1 rounded-lg bg-graphite-800 hover:bg-graphite-750 text-graphite-200 text-[11px] transition-colors inline-flex items-center gap-1"
                        title="Inspect Chunks"
                      >
                        <Eye className="w-3 h-3 text-clinical-blue" />
                        <span>Inspect</span>
                      </button>
                      <button
                        onClick={() => handleDelete(doc.doc_id)}
                        className="px-2.5 py-1 rounded-lg bg-graphite-800 hover:bg-clinical-rose/20 text-graphite-400 hover:text-clinical-rose text-[11px] transition-colors inline-flex items-center gap-1"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chunk Inspection Slide-Over Drawer */}
      {selectedDocId && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-graphite-900 border-l border-white/[0.1] shadow-2xl flex flex-col">
          <div className="h-14 border-b border-white/[0.08] px-5 flex items-center justify-between bg-graphite-850">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-clinical-blue" />
              <div>
                <h3 className="text-xs font-semibold text-white">Hierarchical Chunks Inspector</h3>
                <span className="text-[10px] font-mono text-graphite-400">
                  Document UID: {selectedDocId} ({inspectChunks.length} chunks)
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedDocId(null)}
              className="text-graphite-400 hover:text-white p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loadingChunks ? (
              <div className="text-center py-12 text-xs font-mono text-graphite-400">
                Loading chunk records from vector store...
              </div>
            ) : inspectChunks.length === 0 ? (
              <div className="text-center py-12 text-xs text-graphite-400">
                No chunks found for this document.
              </div>
            ) : (
              inspectChunks.map((chunk, idx) => (
                <div
                  key={idx}
                  className="bg-graphite-850 border border-white/[0.06] rounded-xl p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-clinical-blue">
                        {chunk.chunk_id}
                      </span>
                      {(chunk.parent_id || chunk.parent_chunk_id) && (
                        <span className="text-[10px] font-mono text-graphite-500">
                          parent: {chunk.parent_id || chunk.parent_chunk_id}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-graphite-400">
                      {chunk.token_count} tokens
                    </span>
                  </div>

                  <div className="text-[11px] font-medium text-white">{chunk.section}</div>

                  <div className="bg-graphite-950 p-3 rounded-lg border border-white/[0.04] text-[11px] text-graphite-300 leading-relaxed font-sans whitespace-pre-line">
                    {chunk.content}
                  </div>

                  <div className="text-[10px] font-mono text-graphite-500 truncate">
                    SHA-256 Hash: {chunk.content_hash}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
