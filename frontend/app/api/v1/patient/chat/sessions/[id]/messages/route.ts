import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  try {
    const body = await request.json();
    const userMessage: string = body.content || "";

    // Emergency Detection
    const isEmergency = /chest pain|shortness of breath|difficulty breathing|stroke|bleeding|বুকের ব্যথা|শ্বাসকষ্ট|রক্তক্ষরণ/i.test(userMessage);
    const isBengali = /[\u0980-\u09FF]/.test(userMessage);

    let assistantResponse = "";
    if (isEmergency) {
      assistantResponse = isBengali
        ? "⚠️ জরুরি সতর্কতা: আপনার বর্ণিত লক্ষণগুলি গুরুতর হতে পারে। অনুগ্রহ করে অবিলম্বে জাতীয় জরুরি সেবা ৯৯৯ নম্বরে কল করুন অথবা নিকটস্থ হাসপাতালের জরুরি বিভাগে যোগাযোগ করুন।"
        : "⚠️ RED-FLAG EMERGENCY ALERT: Your symptoms may indicate an acute medical emergency. Please immediately call 911 (or local emergency services) or proceed to the nearest emergency department.";
    } else if (isBengali) {
      assistantResponse = `ধন্যবাদ। আমি সিন্যাপ্স ক্লিনিক্যাল এআই নেভিগেটর। আপনার প্রশ্ন: "${userMessage}"। ক্লিনিক্যাল প্রটোকল অনুসারে সাধারণ তথ্য প্রদান করা হচ্ছে। প্রেসক্রিপশন পরিবর্তনের জন্য দয়া করে আপনার চিকিৎসকের পরামর্শ নিন।`;
    } else {
      assistantResponse = `Thank you for reaching out. Based on Synapse Clinical health protocols, here is evidence-grounded information regarding: "${userMessage}". Please note that this guidance is informational and any change to medications requires clinician consultation.`;
    }

    const disclaimer = isBengali
      ? "\n\n[সতর্কতা: এটি পোর্টফোলিও ও তথ্যমূলক উদ্দেশ্যে প্রস্তুত। এটি চূড়ান্ত চিকিৎসা প্রেসক্রিপশন নয়।]"
      : "\n\n[Regulatory Disclaimer: For educational and informational support only. Does not replace professional medical judgment.]";

    return NextResponse.json({
      message_id: `MSG_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      session_id: sessionId,
      role: "assistant",
      content: assistantResponse + disclaimer,
      is_emergency: isEmergency,
      intent: isEmergency ? "EMERGENCY_TRIAGE" : "MEDICATION_EDUCATION",
      created_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
