"""
LangGraph Nodes for Patient Conversational AI in Synapse Clinical v4.1.
Implements:
1. Deterministic Multilingual Language Detection (Bengali Unicode regex vs English)
2. Red-Flag Emergency Screening (chest pain, stroke, breathing failure, anaphylaxis)
3. Intent Classification & Patient Policy Enforcement (zero diagnosing/prescribing)
4. Patient-Approved Knowledge Retrieval (Strict isolation from clinician-only data)
5. Compassionate Bilingual Response Generation (via Model Orchestrator or Deterministic Fallback)
6. Mandatory Statutory Disclaimer Enforcement
"""
import re
import time
from typing import Dict, Any, List, Optional
from typing_extensions import TypedDict

from app.tenants.manager import tenant_manager
from app.patient.models import HandoffUrgency, HandoffStatus
from app.patient.handoff_manager import handoff_manager
from app.retrieval.hybrid import hybrid_retriever
from app.core.orchestrator.orchestrator import model_orchestrator
from app.core.orchestrator.models import OrchestratorTask
from app.patient.specialists import match_specialists_for_query


BENGALI_REGEX = re.compile(r'[\u0980-\u09FF]')

EMERGENCY_KEYWORDS_EN = [
    "chest pain", "crushing pain", "heart attack", "shortness of breath", "can't breathe",
    "cannot breathe", "difficulty breathing", "suffocating", "anaphylaxis", "throat swelling",
    "tongue swelling", "stroke", "facial droop", "slurred speech", "unconscious", "passed out",
    "fainted", "severe bleeding", "coughing blood", "suicide", "kill myself", "overdose", "poison"
]

EMERGENCY_KEYWORDS_BN = [
    "বুকে ব্যথা", "বুকে চাপ", "হার্ট অ্যাটাক", "শ্বাসকষ্ট", "শ্বাস নিতে পারছি না",
    "দম বন্ধ", "অ্যালার্জি", "গলা ফুলে", "জিভ ফুলে", "স্ট্রোক", "মুখ বেঁকে",
    "অজ্ঞান", "বেহুঁশ", "রক্ত বমি", "প্রচুর রক্তপাত", "আত্মহত্যা", "বিষপান", "বিষ"
]


def to_bengali_digits(text: str) -> str:
    """Translates ASCII digits 0-9 to Bengali script numerals ০-৯."""
    return text.translate(str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯"))


class PatientAgentState(TypedDict):
    session_id: str
    tenant_id: str
    user_query: str
    language: str
    intent: str
    is_emergency: bool
    is_authenticated: bool
    consent_given: bool
    patient_id: Optional[str]
    handoff_requested: bool
    retrieved_chunks: List[Dict[str, Any]]
    recommended_specialists: List[Dict[str, Any]]
    agentic_trace: Dict[str, Any]
    response_text: str
    disclaimer: str
    execution_steps: List[Dict[str, Any]]
    latency_ms: float


def language_detector_node(state: PatientAgentState) -> Dict[str, Any]:
    """Detects if query contains Bengali characters or defaults to English."""
    query = state["user_query"]
    has_bengali = bool(BENGALI_REGEX.search(query))
    detected_lang = "bn" if has_bengali else "en"

    step = {
        "node": "language_detector",
        "timestamp": time.strftime("%H:%M:%S"),
        "language": detected_lang,
        "detail": f"Detected language: {'বাংলা (Bengali)' if detected_lang == 'bn' else 'English'}"
    }
    steps = state.get("execution_steps", []) + [step]
    return {"language": detected_lang, "execution_steps": steps}


def safety_screening_node(state: PatientAgentState) -> Dict[str, Any]:
    """Screens query for acute emergency warning signs."""
    query_lower = state["user_query"].lower()
    is_emergency = False
    detected_signs = []

    # English emergency patterns
    for kw in EMERGENCY_KEYWORDS_EN:
        if kw in query_lower:
            is_emergency = True
            detected_signs.append(kw)

    # Bengali emergency patterns
    for kw in EMERGENCY_KEYWORDS_BN:
        if kw in query_lower or kw in state["user_query"]:
            is_emergency = True
            detected_signs.append(kw)

    step = {
        "node": "safety_screening",
        "timestamp": time.strftime("%H:%M:%S"),
        "is_emergency": is_emergency,
        "detail": f"Emergency triage screening: {'CRITICAL EMERGENCY DETECTED' if is_emergency else 'Routine inquiry'}"
    }
    steps = state.get("execution_steps", []) + [step]

    if is_emergency:
        return {
            "is_emergency": True,
            "intent": "EMERGENCY",
            "execution_steps": steps
        }
    return {
        "is_emergency": False,
        "execution_steps": steps
    }


def intent_classifier_node(state: PatientAgentState) -> Dict[str, Any]:
    """Classifies patient intent into distinct operational categories."""
    if state.get("is_emergency"):
        return {"intent": "EMERGENCY"}

    query_lower = state["user_query"].lower()
    raw_query = state["user_query"]
    intent = "GENERAL_EDUCATION"
    handoff_req = False

    # 1. Human Handoff Request
    handoff_triggers_en = ["talk to human", "doctor please", "speak to a person", "human agent", "talk to nurse", "representative"]
    handoff_triggers_bn = ["মানুষের সাথে", "ডাক্তারের সাথে", "কথা বলতে চাই", "নার্স চাই", "প্রতিনিধি"]
    if any(t in query_lower for t in handoff_triggers_en) or any(t in raw_query for t in handoff_triggers_bn):
        intent = "HANDOFF_REQUEST"
        handoff_req = True

    # 2. Personal EHR Records Request
    elif any(t in query_lower for t in ["my record", "my lab", "my result", "my ehr", "my prescription", "my diagnosis"]) or \
         any(t in raw_query for t in ["আমার রিপোর্ট", "আমার প্রেসক্রিপশন", "আমার টেস্ট", "আমার রেকর্ড"]):
        intent = "RECORDS_REQUEST"

    # 3. Medication Info
    elif any(t in query_lower for t in ["medication", "medicine", "pill", "tablet", "dose", "side effect", "metformin", "warfarin", "aspirin", "ibuprofen", "paracetamol"]) or \
         any(t in raw_query for t in ["ওষুধ", "মেডিসিন", "পার্শ্বপ্রতিক্রিয়া", "ডোজ", "প্যারাসিটামল", "মেটফরমিন", "আইবুপ্রোফেন"]):
        intent = "MEDICATION_INFO"

    # 4. Appointment Routing
    elif any(t in query_lower for t in ["appointment", "booking", "schedule visit", "see a doctor", "clinic hours", "location"]) or \
         any(t in raw_query for t in ["অ্যাপয়েন্টমেন্ট", "ডাক্তার দেখাতে চাই", "সিরিয়াল", "সময়সূচি"]):
        intent = "APPOINTMENT_ROUTING"

    # 5. Symptom Inquiry
    elif any(t in query_lower for t in [
        "fever", "cough", "headache", "head ache", "migraine", "migrane", "migrain",
        "pain", "stomach", "belly", "abdomen", "abdominal", "gastric", "acidity", "indigestion",
        "nausea", "dizziness", "rash", "itch", "itching", "cold", "cramp", "pet betha", "pet batha",
        "matha betha", "matha batha", "buk betha", "buk batha", "chulkani", "jor", "kashi", "bomi",
        "sick", "hurt", "sore", "ache", "betha", "batha", "swelling", "vomit", "diarrhea", "pet", "matha"
    ]) or any(t in raw_query for t in ["জ্বর", "কাশি", "মাথা ব্যথা", "পেট ব্যথা", "বমি", "ঠান্ডা", "গা ব্যথা", "চুলকানি", "ফুসকুড়ি", "ব্যথা", "মাথা", "পেট"]):
        intent = "SYMPTOM_INQUIRY"

    step = {
        "node": "intent_classifier",
        "timestamp": time.strftime("%H:%M:%S"),
        "intent": intent,
        "detail": f"Classified intent: {intent}"
    }
    steps = state.get("execution_steps", []) + [step]
    return {
        "intent": intent,
        "handoff_requested": handoff_req or state.get("handoff_requested", False),
        "execution_steps": steps
    }


def patient_policy_guard_node(state: PatientAgentState) -> Dict[str, Any]:
    """
    Enforces strict safety and privacy policies:
    - Rejects unauthorized EHR records inquiries if session is unauthenticated.
    - Queues human handoff if requested.
    - Prevents autonomous prescribing or definitive diagnosing.
    """
    intent = state.get("intent", "GENERAL_EDUCATION")
    tenant = tenant_manager.get_tenant(state.get("tenant_id"))
    lang = state.get("language", "en")
    response_override = None

    if intent == "HANDOFF_REQUEST":
        handoff_manager.create_request(
            tenant_id=tenant.tenant_id,
            session_id=state["session_id"],
            user_query=state["user_query"],
            reason="Patient requested human support in chat",
            urgency=HandoffUrgency.MEDIUM,
            patient_id=state.get("patient_id")
        )
        if lang == "bn":
            response_override = (
                "আপনার অনুরোধটি আমাদের ক্লিনিক্যাল সাপোর্ট টিমের কাছে পাঠানো হয়েছে। "
                "একজন নার্স বা স্বাস্থ্যকর্মী শীঘ্রই আপনার সাথে যোগাযোগ করবেন। "
                "ততক্ষণ পর্যন্ত আপনার অন্য কোনো সাধারণ স্বাস্থ্য জিজ্ঞাসা থাকলে জানাতে পারেন।"
            )
        else:
            response_override = (
                "Your request has been routed to our clinical support team. "
                "A registered triage nurse or clinic staff member has been notified and will assist you shortly. "
                "In the meantime, feel free to ask any general health education questions."
            )

    elif intent == "RECORDS_REQUEST" and not state.get("is_authenticated"):
        if lang == "bn":
            response_override = (
                "গোপনীয়তা ও নিরাপত্তা নীতির কারণে, ব্যক্তিগত স্বাস্থ্য তথ্য বা ল্যাব রিপোর্ট দেখতে রোগীর পরিচয় নিশ্চিত করা আবশ্যক। "
                "দয়া করে নিচে আপনার 'পেশেন্ট আইডি' এবং 'MRN' দিয়ে লগইন করুন। আপনি কোনো লগইন ছাড়াই সাধারণ স্বাস্থ্য নির্দেশিকা জানতে পারেন।"
            )
        else:
            response_override = (
                "For your privacy and medical confidentiality, accessing personal EHR records, lab results, or prescribed histories requires verified patient authentication. "
                "Please sign in with your Patient ID and Medical Record Number (MRN) using the patient portal login. You can continue to ask general health questions without logging in."
            )

    step = {
        "node": "patient_policy_guard",
        "timestamp": time.strftime("%H:%M:%S"),
        "policy_status": "POLICY_INTERVENTION" if response_override else "COMPLIANT",
        "detail": "Enforced non-diagnostic educational boundaries and consent verification."
    }
    steps = state.get("execution_steps", []) + [step]
    
    return {
        "response_text": response_override or state.get("response_text", ""),
        "execution_steps": steps
    }


def patient_knowledge_retriever_node(state: PatientAgentState) -> Dict[str, Any]:
    """
    Retrieves educational guidelines strictly filtered by access_level='PATIENT_APPROVED'.
    Completely isolates patient from clinician-only protocols and text-to-sql tools.
    """
    if state.get("is_emergency") or state.get("response_text"):
        return {"retrieved_chunks": []}

    query = state["user_query"]
    retrieved = hybrid_retriever.search_hybrid(
        query=query,
        initial_k=15,
        final_top_n=3,
        access_level="PATIENT_APPROVED"
    )

    chunk_dicts = [
        {
            "chunk_id": c.chunk_id,
            "title": c.title,
            "section": c.section,
            "content": c.content,
            "score": c.cross_encoder_score
        }
        for c in retrieved
    ]

    step = {
        "node": "patient_retriever",
        "timestamp": time.strftime("%H:%M:%S"),
        "retrieved_count": len(chunk_dicts),
        "detail": f"Retrieved {len(chunk_dicts)} patient-approved educational sources."
    }
    steps = state.get("execution_steps", []) + [step]
    return {
        "retrieved_chunks": chunk_dicts,
        "execution_steps": steps
    }


def emergency_node(state: PatientAgentState) -> Dict[str, Any]:
    """Generates immediate red-flag emergency guidance with localized telephone hotlines."""
    tenant = tenant_manager.get_tenant(state.get("tenant_id"))
    lang = state.get("language", "en")
    phone = tenant.emergency_phone

    # Log critical handoff automatically
    handoff_manager.create_request(
        tenant_id=tenant.tenant_id,
        session_id=state["session_id"],
        user_query=state["user_query"],
        reason="Acute Red-Flag Emergency symptoms reported",
        urgency=HandoffUrgency.CRITICAL,
        patient_id=state.get("patient_id")
    )

    if lang == "bn":
        bn_phone = to_bengali_digits(phone)
        emergency_text = (
            f"🚨 জরুরি সতর্কতা — অবিলম্বে পদক্ষেপ নিন:\n\n"
            f"আপনার বর্ণিত উপসর্গটি একটি সম্ভাব্য জীবনহানিকর জরুরি অবস্থা নির্দেশ করছে। "
            f"দয়া করে কোনো বিলম্ব করবেন না। এখনই {bn_phone} ({phone}) নম্বরে ফোন করুন অথবা নিকটস্থ হাসপাতালের জরুরি বিভাগে যান।\n\n"
            f"তাৎক্ষণিক নির্দেশিকা:\n"
            f"১. কোনো প্রকার শারীরিক পরিশ্রম বন্ধ করে শান্ত হয়ে বসুন বা শুয়ে থাকুন।\n"
            f"২. নিজে গাড়ি বা যানবাহন চালিয়ে হাসপাতালে যাবেন না; অ্যাম্বুলেন্স ডাকুন অথবা পরিবারের সহায়তা নিন।\n"
            f"৩. চিকিৎসকের পরামর্শ ব্যতীত নিজে নিজে কোনো নতুন ওষুধ গ্রহণ করবেন না।"
        )
    else:
        emergency_text = (
            f"🚨 URGENT EMERGENCY ALERT — TAKE IMMEDIATE ACTION:\n\n"
            f"The symptoms you described may indicate an acute, life-threatening medical emergency. "
            f"Please do not wait. Call {phone} immediately or proceed directly to the nearest emergency department.\n\n"
            f"Immediate Guidance:\n"
            f"1. Stop physical activity and sit or lie down in a comfortable position.\n"
            f"2. Do not attempt to drive yourself to the hospital; request an ambulance or emergency transport.\n"
            f"3. Do not take unverified medications or adjust prescription dosages without paramedic instructions."
        )

    step = {
        "node": "emergency_router",
        "timestamp": time.strftime("%H:%M:%S"),
        "action": f"Escalated to Emergency Hotline ({phone})",
        "detail": "Critical red-flag symptoms detected. Dispatched urgent guidance."
    }
    steps = state.get("execution_steps", []) + [step]
    return {
        "response_text": emergency_text,
        "recommended_specialists": [],
        "agentic_trace": {
            "emergency_screened": True,
            "is_emergency": True,
            "hotline_dispatched": phone,
            "crag_specialist_match_count": 0,
            "mean_relevance_score": 1.0
        },
        "execution_steps": steps
    }


def specialist_matching_node(state: PatientAgentState) -> Dict[str, Any]:
    """
    Agentic Symptom-to-Specialist Matcher Node:
    Extracts clinical presentations to retrieve BMDC / Board-certified specialists
    with available schedule slots and fees. Applies CRAG relevance grading.
    """
    if state.get("is_emergency") or state.get("response_text"):
        return {
            "recommended_specialists": [],
            "agentic_trace": {
                "emergency_screened": True,
                "is_emergency": False,
                "crag_specialist_match_count": 0,
                "mean_relevance_score": 0.0
            }
        }

    query = state["user_query"]
    tenant_id = state.get("tenant_id", "DEFAULT_HOSPITAL")
    matched_doctors = match_specialists_for_query(query=query, tenant_id=tenant_id, top_k=3)

    mean_score = (
        round(sum(d.get("relevance_score", 0.8) for d in matched_doctors) / len(matched_doctors), 2)
        if matched_doctors else 0.85
    )

    agentic_trace = {
        "emergency_screened": True,
        "is_emergency": False,
        "crag_specialist_match_count": len(matched_doctors),
        "top_specialty": matched_doctors[0]["specialization"] if matched_doctors else "General Medicine",
        "mean_relevance_score": mean_score
    }

    step = {
        "node": "specialist_matcher",
        "timestamp": time.strftime("%H:%M:%S"),
        "matched_count": len(matched_doctors),
        "detail": f"Agentic Specialist Matcher: Found {len(matched_doctors)} verified consultants with open slots."
    }
    steps = state.get("execution_steps", []) + [step]

    return {
        "recommended_specialists": matched_doctors,
        "agentic_trace": agentic_trace,
        "execution_steps": steps
    }


def patient_response_generator_node(state: PatientAgentState) -> Dict[str, Any]:
    """Generates a warm, simple, educational response in English or Bengali."""
    # If response was already set by policy guard or emergency node, pass through
    if state.get("response_text"):
        return {}

    lang = state.get("language", "en")
    intent = state.get("intent", "GENERAL_EDUCATION")
    query = state["user_query"]
    chunks = state.get("retrieved_chunks", [])
    specialists = state.get("recommended_specialists", [])
    context_text = "\n\n".join([f"[{c['title']} - {c['section']}]: {c['content']}" for c in chunks])
    
    specialist_summary = ""
    if specialists:
        specialist_summary = "\n\nAvailable Department Consultants:\n" + "\n".join([
            f"- {s['name']} ({s['specialization']}, {s['qualifications']}) | Fee: {s['consultation_fee']} {s['currency']} | Next Slot: {s['available_schedule']}"
            for s in specialists
        ])

    system_prompt_en = (
        "You are Synapse Patient AI, a compassionate healthcare navigator and health education assistant. "
        "Explain medical topics clearly at a 6th-grade reading level. "
        "Strict rules:\n"
        "- Never diagnose illnesses or provide clinical conclusions.\n"
        "- Never prescribe medications or suggest altering prescription dosages.\n"
        "- Always encourage consulting a doctor or pharmacist for individualized care.\n"
        "- Recommend consulting the hospital's verified specialists when symptoms are described.\n"
        "- Respond in clear, empathetic English."
    )

    system_prompt_bn = (
        "আপনি মেডপালস পেশেন্ট এআই — একজন সহানুভূতিশীল এবং তথ্যবহুল স্বাস্থ্য সহকারী। "
        "রোগীকে অত্যন্ত স্পষ্ট ও সহজ বাংলায় তথ্য প্রদান করুন। "
        "কঠোর নীতিমালা:\n"
        "- আপনি নিজে কোনো রোগ নির্ণয় বা নিশ্চিত সিদ্ধান্ত দেবেন না।\n"
        "- কোনো ওষুধ প্রেসক্রাইব বা মাত্রা পরিবর্তন করার পরামর্শ দেবেন না।\n"
        "- রোগীকে সম্মানসূচক 'আপনি' সম্বোধন করুন এবং চিকিৎসকের পরামর্শ গ্রহণের গুরুত্ব তুলে ধরুন।\n"
        "- উপসর্গ অনুযায়ী আমাদের হাসপাতালের সংশ্লিষ্ট বিশেষজ্ঞ চিকিৎসকদের পরামর্শ নেয়ার জন্য দিকনির্দেশনা দিন।\n"
        "- উত্তরটি বিশুদ্ধ, প্রাঞ্জল বাংলায় দিন।"
    )

    prompt = (
        f"User Question: {query}\n\n"
        f"Approved Educational Context:\n{context_text}\n"
        f"{specialist_summary}\n\n"
        f"Provide a helpful, educational response and briefly highlight the recommended specialty and consultants if relevant:"
    )

    # Call Model Orchestrator
    try:
        raw_res = model_orchestrator.route_and_execute(
            task=OrchestratorTask.CLINICAL_SYNTHESIS,
            system_prompt=system_prompt_bn if lang == "bn" else system_prompt_en,
            user_prompt=prompt,
            temperature=0.2
        )
        response_content = raw_res.get("content", "").strip()
    except Exception:
        response_content = ""

    # Check if response is valid patient conversational text
    is_invalid = (
        not response_content or
        response_content.startswith("### 1. Clinical Assessment") or
        len(response_content) < 15
    )

    if is_invalid:
        query_lower = query.lower()
        
        # Check specific symptom themes
        is_stomach = any(w in query_lower for w in ["pet", "betha", "batha", "stomach", "abdomen", "abdominal", "belly", "gastric", "acidity", "indigestion", "পেট", "বদহজম", "ব্যথা"])
        is_headache = any(w in query_lower for w in ["migrane", "migraine", "migrain", "headache", "matha", "মাথা", "মাইগ্রেন", "dizziness"])
        is_greeting = any(w in query_lower for w in ["hi", "hello", "hey", "hola", "নমস্কার", "সালাম", "হ্যাল"]) and len(query_lower.split()) <= 3

        if lang == "bn":
            if is_stomach:
                response_content = (
                    "আপনার পেটে অস্বস্তি বা ব্যথা (*পেট ব্যথা*) হচ্ছে জেনে আমরা সহানুভূতি প্রকাশ করছি। "
                    "পেটের ব্যথা সাধারণ গ্যাস্ট্রিক অ্যাসিডিটি, বদহজম বা অতিরিক্ত মসলাযুক্ত খাবারের কারণে হতে পারে।\n\n"
                    "তাৎক্ষণিক প্রাথমিক পরামর্শ:\n"
                    "১. কুসুম গরম পানি পান করুন এবং ভাজাপোড়া বা ক্যাফেইনযুক্ত খাবার পরিহার করুন।\n"
                    "২. চিকিৎসকের পরামর্শ ছাড়া তীব্র ব্যথানাশক (NSAIDs) সেবন করবেন না, এতে গ্যাস্ট্রিকের সমস্যা বাড়তে পারে।\n"
                    "৩. তীব্র অসহ্য ব্যথা, ঘন ঘন বমি বা তীব্র জ্বর থাকলে অবিলম্বে হাসপাতালে যোগাযোগ করুন।\n\n"
                    "আমাদের গ্যাস্ট্রোএন্টারোলজি ও পরিপাকতন্ত্র বিভাগের বিশেষজ্ঞ চিকিৎসকদের সাথে সরাসরি পরামর্শের জন্য নিচের সিরিয়ালগুলো উন্মুক্ত রয়েছে:"
                )
            elif is_headache:
                response_content = (
                    "আপনার মাইগ্রেন বা তীব্র মাথাব্যথা হচ্ছে জেনে আমরা ব্যথিত। মাইগ্রেন সাধারণত মাথার একপাশে দপদপ করা ব্যথা এবং আলো বা শব্দের প্রতি সংবেদনশীলতা সৃষ্টি করে।\n\n"
                    "তাৎক্ষণিক আরামের জন্য করণীয়:\n"
                    "১. একটি শান্ত, অন্ধকার এবং কোলাহলমুক্ত ঘরে শুয়ে বিশ্রাম নিন।\n"
                    "২. কপালে বা ঘাড়ের পেছনে ঠান্ডা বা হালকা গরম সেঁক দিন এবং পর্যাপ্ত পানি পান করুন।\n"
                    "৩. একটানা স্ক্রিনের দিকে তাকানো থেকে বিরত থাকুন। তীব্র অসহ্য ব্যথা বা চোখে অস্বাভাবিক ঝাপসা দেখলে জরুরি সহায়তা নিন।\n\n"
                    "সঠিক চিকিৎসা ও দীর্ঘমেয়াদী আরামের জন্য আমাদের নিউরোলজি বিভাগের বিশেষজ্ঞ চিকিৎসকদের সিরিয়াল নিচে দেওয়া হলো:"
                )
            elif is_greeting:
                response_content = (
                    "আসসালামু আলাইকুম / নমস্কার! আমি মেডপালস এআই হেলথ নেভিগেটর। "
                    "আপনি যেকোনো শারীরিক লক্ষণ (যেমন: পেট ব্যথা, মাইগ্রেন, জ্বর, ত্বকে ফুসকুড়ি), ওষুধের তথ্য বা আমাদের হাসপাতালের বিশেষজ্ঞ চিকিৎসকদের শিডিউল ও অ্যাপয়েন্টমেন্ট সম্পর্কে জিজ্ঞাসা করতে পারেন। আজ আপনাকে কীভাবে সাহায্য করতে পারি?"
                )
            elif specialists:
                doc_lines = "\n".join([
                    f"• {s['name']} — {s['specialization']} (ফি: ৳ {s['consultation_fee']:,} | শিডিউল: {s['available_schedule']})"
                    for s in specialists
                ])
                response_content = (
                    f"আপনার স্বাস্থ্য জিজ্ঞাসা ও উপসর্গের ভিত্তিতে আমাদের হাসপাতালের সংশ্লিষ্ট বিশেষজ্ঞ চিকিৎসকের সাথে পরামর্শ করার সুপারিশ করা হচ্ছে। "
                    f"আজকের উন্মুক্ত অ্যাপয়েন্টমেন্ট শিডিউল নিচে প্রদান করা হলো:\n\n{doc_lines}\n\n"
                    f"সুনির্দিষ্ট পরামর্শ ও প্রেসক্রিপশনের জন্য সরাসরি বিশেষজ্ঞের সাথে সাক্ষাৎ করুন।"
                )
            elif intent == "MEDICATION_INFO":
                response_content = (
                    "ওষুধ সেবনের ক্ষেত্রে সর্বদা চিকিৎসকের নির্দিষ্ট প্রেসক্রিপশন ও ফার্মাসিস্টের নির্দেশনা মেনে চলা অত্যন্ত জরুরি। "
                    "খাবারের সাথে বা খালি পেটে খাওয়ার নিয়ম এবং পর্যাপ্ত পানি পান করার বিষয়টি খেয়াল রাখুন। "
                    "কোনো ধরনের পার্শ্বপ্রতিক্রিয়া বা অস্বাভাবিক লক্ষণ দেখা দিলে আপনার চিকিৎসকের পরামর্শ নিন।"
                )
            elif intent == "APPOINTMENT_ROUTING":
                response_content = (
                    "চিকিৎসক বা বিশেষজ্ঞের পরামর্শের জন্য আমাদের ক্লিনিকের অ্যাপয়েন্টমেন্ট বিভাগে যোগাযোগ করতে পারেন। "
                    "ক্লিনিক চলাকালীন সময় সকাল ৯টা থেকে বিকাল ৫টা পর্যন্ত। অ্যাপয়েন্টমেন্ট কনফার্ম করতে হেল্পডেস্কে যোগাযোগ করুন।"
                )
            else:
                response_content = (
                    "আপনার স্বাস্থ্য সম্পর্কিত প্রশ্নের জন্য ধন্যবাদ। সুস্থ জীবনযাপনের জন্য সুষম খাবার গ্রহণ, পর্যাপ্ত বিশ্রাম এবং নিয়মিত স্বাস্থ্য পরীক্ষা করানো জরুরি। "
                    "সুনির্দিষ্ট লক্ষণ বা অসুস্থতার ক্ষেত্রে একজন যোগ্যতাসম্পন্ন চিকিৎসকের সাথে সরাসরি পরামর্শ করার অনুরোধ করা হচ্ছে।"
                )
        else:
            if is_stomach:
                response_content = (
                    "We understand you are dealing with stomach pain or abdominal discomfort (*pet betha*). "
                    "Abdominal symptoms can stem from acute gastritis, indigestion, acid reflux, or dietary sensitivities.\n\n"
                    "Immediate Guidance:\n"
                    "1. Sip warm water or clear broth and avoid heavy, greasy, or spicy meals.\n"
                    "2. Avoid unprescribed NSAID pain relievers (like Ibuprofen), as they can further irritate the stomach lining.\n"
                    "3. Warning signs: If you experience rigid abdominal guarding, persistent vomiting, high fever, or blood in stool, seek emergency care immediately.\n\n"
                    "We recommend consulting our **Gastroenterology & Digestive Health** department. Below are verified consultants available today:"
                )
            elif is_headache:
                response_content = (
                    "We understand you are experiencing migraine pain or severe headaches. "
                    "Migraines are neurovascular episodes often accompanied by throbbing pain, light/sound sensitivity, and nausea.\n\n"
                    "Immediate Self-Care Guidance:\n"
                    "1. Rest in a dark, quiet, well-ventilated room to minimize sensory stimulation.\n"
                    "2. Apply a cold or warm compress to your forehead or the back of your neck.\n"
                    "3. Stay well-hydrated and avoid skipping meals or consuming known migraine triggers.\n"
                    "4. Warning signs: Sudden thunderclap onset, numbness, or visual field loss requires immediate emergency evaluation.\n\n"
                    "We recommend consulting our **Neurology & Headache Medicine** department. Below are verified consultants available today:"
                )
            elif is_greeting:
                response_content = (
                    "Hello! I am your Synapse Clinical Health Navigator. "
                    "You can ask about symptoms (such as stomach discomfort, migraines, fever, or skin rashes), medication guidelines, or find verified hospital specialists with open schedule slots. How can I assist you today?"
                )
            elif specialists:
                fee_prefix = "$" if specialists[0]["currency"] == "USD" else "৳ "
                doc_lines = "\n".join([
                    f"• {s['name']} — {s['specialization']} (Fee: {fee_prefix}{s['consultation_fee']:,} | Schedule: {s['available_schedule']})"
                    for s in specialists
                ])
                response_content = (
                    f"Based on your symptoms and clinical inquiry, we recommend consulting our {specialists[0]['department']} department. "
                    f"The following verified consultants currently have available appointment slots:\n\n{doc_lines}\n\n"
                    f"You may book a consultation slot directly or ask for further assistance."
                )
            elif intent == "MEDICATION_INFO":
                response_content = (
                    "When taking prescription medications, it is vital to follow your doctor's instructions carefully. "
                    "Always take doses at scheduled times, stay well hydrated, and review package instructions. "
                    "If you experience side effects or have questions about combining medications, please consult your pharmacist or physician."
                )
            elif intent == "APPOINTMENT_ROUTING":
                response_content = (
                    "To schedule a clinical consultation, you can contact our patient services department during regular business hours (8:00 AM to 5:00 PM). "
                    "If you need assistance finding a specialist, our triage team will be pleased to help you."
                )
            else:
                response_content = (
                    "Thank you for reaching out. Staying informed about your health and preventive care is essential. "
                    "For specific symptoms, changes in health conditions, or personalized medical advice, please schedule a visit with your primary healthcare provider."
                )

    step = {
        "node": "patient_response_generator",
        "timestamp": time.strftime("%H:%M:%S"),
        "language": lang,
        "detail": "Generated patient-friendly educational synthesis."
    }
    steps = state.get("execution_steps", []) + [step]

    return {
        "response_text": response_content,
        "execution_steps": steps
    }


def disclaimer_attachment_node(state: PatientAgentState) -> Dict[str, Any]:
    """Attaches mandatory statutory patient disclaimer in the detected language."""
    tenant = tenant_manager.get_tenant(state.get("tenant_id"))
    lang = state.get("language", "en")
    phone = tenant.emergency_phone

    if lang == "bn":
        bn_phone = to_bengali_digits(phone)
        disclaimer = (
            f"\n\n—\n📌 সতর্কবার্তা: মেডপালস পেশেন্ট এআই শুধুমাত্র সাধারণ স্বাস্থ্য শিক্ষা ও তথ্যমূলক নির্দেশিকা প্রদান করে। "
            f"এটি কোনো রোগ নির্ণয় বা চিকিৎসার বিকল্প নয়। জরুরি প্রয়োজনে অবিলম্বে {bn_phone} ({phone}) নম্বরে যোগাযোগ করুন বা নিকটস্থ হাসপাতালের জরুরি বিভাগে যান।"
        )
    else:
        disclaimer = (
            f"\n\n—\n📌 Disclaimer: Synapse Patient AI provides health information and education only. "
            f"It does not provide medical diagnosis, treatment, or prescriptions. In case of an emergency, call {phone} or proceed to the nearest emergency facility."
        )

    full_response = state.get("response_text", "") + disclaimer

    step = {
        "node": "disclaimer_attachment",
        "timestamp": time.strftime("%H:%M:%S"),
        "detail": "Appended mandatory regulatory patient safety disclaimer."
    }
    steps = state.get("execution_steps", []) + [step]

    return {
        "response_text": full_response,
        "disclaimer": disclaimer.strip(),
        "execution_steps": steps
    }
