import { NextResponse } from "next/server";
import { TENANTS } from "@/app/api/_data/demo_data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = body.tenant_id || "DEFAULT_HOSPITAL";
    const tenant = TENANTS.find((t) => t.tenant_id === tenantId) || TENANTS[0];
    const isBn = body.language === "bn" || tenant.default_language === "bn";

    const sessionId = `SESS_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const welcome = isBn ? tenant.welcome_message_bn : tenant.welcome_message_en;

    return NextResponse.json({
      session_id: sessionId,
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.name,
      language: isBn ? "bn" : "en",
      welcome_message: welcome,
      emergency_phone: tenant.emergency_phone,
      is_authenticated: false,
      consent_given: Boolean(body.consent_given),
      created_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to initialize session" }, { status: 400 });
  }
}
