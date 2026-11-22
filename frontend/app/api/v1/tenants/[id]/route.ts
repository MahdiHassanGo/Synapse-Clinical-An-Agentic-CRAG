import { NextResponse } from "next/server";
import { TENANTS } from "@/app/api/_data/demo_data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenant = TENANTS.find((t) => t.tenant_id.toLowerCase() === id.toLowerCase()) || TENANTS[0];
  return NextResponse.json(tenant);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    return NextResponse.json({
      success: true,
      tenant_id: id,
      ...body,
      updated_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to update tenant" }, { status: 400 });
  }
}
