import { NextResponse } from "next/server";
import { GUIDELINES } from "@/app/api/_data/demo_data";

export async function GET() {
  const backendUrl = process.env.BACKEND_INTERNAL_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/knowledge/documents`, { cache: "no-store" });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // Fallback
    }
  }

  return NextResponse.json({
    count: GUIDELINES.length,
    documents: GUIDELINES,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({
      success: true,
      document: {
        doc_id: `DOC_${Date.now()}`,
        title: body.title || "Custom Guideline",
        source_organization: body.source_organization || "Clinical Team",
        chunk_count: 4,
        status: "INDEXED",
        access_level: "CLINICIAN_ONLY",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to create document" }, { status: 400 });
  }
}
