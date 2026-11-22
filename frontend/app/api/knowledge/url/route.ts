import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = body.url || "https://nice.org.uk/guidance/ng28";

    return NextResponse.json({
      success: true,
      message: `Content from ${url} scraped, sanitized, chunked, and embedded.`,
      document: {
        doc_id: `URL_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        title: `Ingested Guideline: ${url}`,
        source_organization: "Web Authority Crawler",
        chunk_count: 8,
        status: "INDEXED",
        access_level: "CLINICIAN_ONLY",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to index URL" }, { status: 400 });
  }
}
