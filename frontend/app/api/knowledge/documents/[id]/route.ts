import { NextResponse } from "next/server";
import { GUIDELINES } from "@/app/api/_data/demo_data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = GUIDELINES.find((g) => g.doc_id === id) || GUIDELINES[0];

  const chunks = [
    {
      chunk_id: `${id}_CHUNK_001`,
      doc_id: id,
      chunk_index: 0,
      content: `[Section 1.4: Renal Thresholds & Contraindications]\nIn patients with chronic kidney disease (CKD), review eGFR prior to initiation of metformin. If eGFR is 30-44 mL/min/1.73m², maximum recommended dose is 1000 mg daily. If eGFR < 30 mL/min/1.73m² (KDIGO Stage 4 or 5), metformin is strictly contraindicated due to the lethal hazard of metformin-associated lactic acidosis (MALA).`,
      token_count: 78,
      embedding_model: "text-embedding-3-small",
    },
    {
      chunk_id: `${id}_CHUNK_002`,
      doc_id: id,
      chunk_index: 1,
      content: `[Section 2.1: Anticoagulant Interactions]\nConcurrent administration of vitamin K antagonists (such as Warfarin) with non-steroidal anti-inflammatory drugs (NSAIDs, e.g., Ibuprofen, Naproxen) increases the relative risk of major gastrointestinal hemorrhage up to fourfold. Co-prescription requires explicit specialist override or substitution with Paracetamol/Acetaminophen.`,
      token_count: 65,
      embedding_model: "text-embedding-3-small",
    },
  ];

  return NextResponse.json({
    document: doc,
    chunks,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({
    success: true,
    doc_id: id,
    message: `Document ${id} deleted successfully.`,
  });
}
