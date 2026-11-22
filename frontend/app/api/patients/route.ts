import { NextResponse } from "next/server";
import { PATIENTS_LIST } from "@/app/api/_data/demo_data";

export async function GET() {
  const backendUrl = process.env.BACKEND_INTERNAL_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/patients`, { cache: "no-store" });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // Fallback to local demo data
    }
  }

  return NextResponse.json({
    count: PATIENTS_LIST.length,
    patients: PATIENTS_LIST,
  });
}
