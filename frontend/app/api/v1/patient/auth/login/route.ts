import { NextResponse } from "next/server";
import { PATIENTS_LIST } from "@/app/api/_data/demo_data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mrn = (body.mrn || "").trim().toUpperCase();
    const lastName = (body.last_name || "").trim().toLowerCase();

    // Match patient by MRN or last name
    const matched = PATIENTS_LIST.find(
      (p) =>
        p.mrn.toUpperCase() === mrn ||
        p.patient_id.toUpperCase() === mrn ||
        p.last_name.toLowerCase() === lastName
    ) || PATIENTS_LIST[0];

    return NextResponse.json({
      success: true,
      message: "Patient authenticated successfully",
      patient: matched,
    });
  } catch {
    return NextResponse.json({ error: "Authentication failed" }, { status: 400 });
  }
}
