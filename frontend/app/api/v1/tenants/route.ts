import { NextResponse } from "next/server";
import { TENANTS } from "@/app/api/_data/demo_data";

export async function GET() {
  const backendUrl = process.env.BACKEND_INTERNAL_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/v1/tenants`, { cache: "no-store" });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // Fallback
    }
  }

  return NextResponse.json({
    tenants: TENANTS,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({
      success: true,
      tenant: {
        ...body,
        tenant_id: body.tenant_id || `TENANT_${Date.now()}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to create tenant" }, { status: 400 });
  }
}
