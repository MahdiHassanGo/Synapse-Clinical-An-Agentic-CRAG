import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  try {
    const body = await request.json();
    const userMessage: string = (body.message || body.content || "").trim();
    const reqLanguage: string = body.language || "en";

    // Emergency Detection
    const isEmergency = /chest pain|shortness of breath|difficulty breathing|stroke|severe bleeding|বুকের ব্যথা|শ্বাসকষ্ট|রক্তক্ষরণ/i.test(userMessage);
    const isBengali = reqLanguage === "bn" || /[\u0980-\u09FF]/.test(userMessage);
    const isHeadacheMigraine = /migraine|headache|vision sensitivity|aura|মাথা ব্যথা|মাইগ্রেন/i.test(userMessage);

    let assistantResponse = "";
    let specialists: any[] = [];

    if (isEmergency) {
      assistantResponse = isBengali
        ? "⚠️ জরুরি সতর্কতা: আপনার বর্ণিত লক্ষণগুলি গুরুতর হতে পারে। অনুগ্রহ করে অবিলম্বে জাতীয় জরুরি সেবা ৯৯৯ নম্বরে কল করুন অথবা নিকটস্থ হাসপাতালের জরুরি বিভাগে যোগাযোগ করুন।"
        : "⚠️ RED-FLAG EMERGENCY ALERT: Your symptoms may indicate an acute medical emergency. Please immediately call 911 (or local emergency services) or proceed to the nearest emergency department.";
    } else if (isHeadacheMigraine) {
      assistantResponse = isBengali
        ? "আপনার উল্লেখিত উপসর্গগুলি (চোখে সংবেদনশীলতাসহ তীব্র মাইগ্রেন) মাইগ্রেন উইথ অরা বা নিউরোলজিক্যাল সেফালালজিয়ার লক্ষণ হতে পারে।\n\n১. সাধারণ পরামর্শ: উজ্জ্বল আলো পরিহার করে শান্ত ও অন্ধকার ঘরে বিশ্রাম নিন এবং পর্যাপ্ত পানি পান করুন।\n২. বিশেষজ্ঞ পরামর্শ: সঠিক রোগ নির্ণয় ও প্রফিল্যাকটিক চিকিৎসার জন্য একজন নিউরোলজিস্টের শরণাপন্ন হওয়া আবশ্যক। নিচে আমাদের হাসপাতালের সংশ্লিষ্ট বিশেষজ্ঞ চিকিৎসকদের তালিকা দেওয়া হলো:"
        : "Based on clinical triage protocols, severe recurring headaches accompanied by visual sensitivity or aura are characteristic of migraine with aura.\n\n1. Immediate Self-Care: Rest in a dark, quiet environment and maintain adequate hydration. Avoid known sensory or dietary triggers.\n2. Clinical Evaluation: Neurological consultation is recommended to rule out secondary etiologies and evaluate prophylactic vs. abortive pharmacotherapy.\n\nHere are the matched specialists currently available at our center:";

      specialists = [
        {
          id: "doc_neuro_01",
          doctor_id: "doc_neuro_01",
          name: isBengali ? "অধ্যাপক ডাঃ তানভীর আহমেদ" : "Prof. Dr. Tanvir Ahmed",
          specialty: isBengali ? "নিউরোলজি ও হেডেক মেডিসিন" : "Neurology & Headache Medicine",
          specialization: isBengali ? "নিউরোলজি ও হেডেক মেডিসিন" : "Neurology & Headache Medicine",
          department: isBengali ? "নিউরোমেডিসিন বিভাগ" : "Department of Neuromedicine",
          qualifications: "MBBS, FCPS (Medicine), MD (Neurology), Fellow (World Headache Society)",
          room_number: "Room 412 (Level 4)",
          consultation_fee: 1500,
          currency: isBengali ? "BDT" : "USD",
          available_schedule: isBengali ? "শনি - বৃহস্পতি: বিকাল ৫:০০ - রাত ৯:০০" : "Sat - Thu: 5:00 PM - 9:00 PM",
          bmdc_reg_no: "BMDC-A-42198",
          bio: "Senior consultant with 18+ years experience in chronic migraine, cluster headache, and neuro-ophthalmology.",
          relevance_score: 0.96,
        },
        {
          id: "doc_neuro_02",
          doctor_id: "doc_neuro_02",
          name: isBengali ? "ডাঃ ফারহানা ইয়াসমিন" : "Dr. Farhana Yasmin",
          specialty: isBengali ? "ক্লিনিক্যাল নিউরোলজি" : "Clinical Neurology",
          specialization: isBengali ? "ক্লিনিক্যাল নিউরোলজি" : "Clinical Neurology",
          department: isBengali ? "নিউরোমেডিসিন বিভাগ" : "Department of Neuromedicine",
          qualifications: "MBBS, MD (Neurology), MRCP (UK)",
          room_number: "Room 415 (Level 4)",
          consultation_fee: 1200,
          currency: isBengali ? "BDT" : "USD",
          available_schedule: isBengali ? "রবি, মঙ্গল, বৃহস্পতি: বিকাল ৪:০০ - রাত ৮:০০" : "Sun, Tue, Thu: 4:00 PM - 8:00 PM",
          bmdc_reg_no: "BMDC-A-56321",
          bio: "Specialist in refractory cephalalgia, trigeminal autonomic cephalalgias, and neuro-imaging.",
          relevance_score: 0.92,
        },
      ];
    } else if (isBengali) {
      assistantResponse = `ধন্যবাদ। আমি সিন্যাপ্স ক্লিনিক্যাল এআই নেভিগেটর। আপনার জিজ্ঞাসা: "${userMessage}"। ক্লিনিক্যাল প্রটোকল অনুসারে সাধারণ তথ্য ও গাইডলাইন প্রদান করা হচ্ছে। প্রেসক্রিপশন এবং চূড়ান্ত মূল্যায়নের জন্য সংশ্লিষ্ট চিকিৎসকের পরামর্শ নিন।`;
    } else {
      assistantResponse = `Thank you for reaching out. Based on Synapse Clinical triage protocols regarding "${userMessage}", here is evidence-grounded guidance. Please note this information is for clinical navigation and cannot replace direct medical evaluation.`;
    }

    const disclaimer = isBengali
      ? "\n\n[সতর্কতা: এটি পোর্টফোলিও ও তথ্যমূলক উদ্দেশ্যে প্রস্তুত। এটি চূড়ান্ত চিকিৎসা প্রেসক্রিপশন নয়।]"
      : "\n\n[Regulatory Disclaimer: For educational and navigational support only. Does not replace professional medical judgment.]";

    const fullContent = assistantResponse + disclaimer;

    return NextResponse.json({
      message_id: `MSG_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      session_id: sessionId,
      role: "assistant",
      response_text: fullContent,
      content: fullContent,
      language: isBengali ? "bn" : "en",
      is_emergency: isEmergency,
      intent: isEmergency ? "EMERGENCY_TRIAGE" : isHeadacheMigraine ? "SPECIALIST_RECOMMENDATION" : "MEDICATION_EDUCATION",
      recommended_specialists: specialists,
      agentic_trace: {
        emergency_screened: true,
        is_emergency: isEmergency,
        crag_specialist_match_count: specialists.length,
        top_specialty: isHeadacheMigraine ? "Neurology & Headache Medicine" : "General Medicine",
        mean_relevance_score: specialists.length > 0 ? 0.94 : 0.85,
        intent: isEmergency ? "EMERGENCY_TRIAGE" : "SPECIALIST_RECOMMENDATION",
        language_detected: isBengali ? "bn" : "en",
      },
      created_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
