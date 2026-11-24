"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Globe,
  AlertTriangle,
  ShieldCheck,
  Send,
  UserCheck,
  Lock,
  RefreshCw,
  Code,
  Copy,
  Check,
  Flame,
  PhoneCall,
  User
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  language?: string;
  is_emergency?: boolean;
  intent?: string;
  recommended_specialists?: any[];
  agentic_trace?: any;
}

export function PatientChatView() {
  const [tenantId, setTenantId] = useState<string>("DEFAULT_HOSPITAL");
  const [language, setLanguage] = useState<string>("en");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [emergencyPhone, setEmergencyPhone] = useState<string>("911");
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authPatientId, setAuthPatientId] = useState<string>("P101");
  const [authMrn, setAuthMrn] = useState<string>("MRN-882190");
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [analytics, setAnalytics] = useState<any>({
    total_sessions: 52,
    total_messages: 214,
    escalation_rate_pct: 3.8,
    average_latency_ms: 320,
    language_distribution: { en: 34, bn: 18 }
  });

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize or fetch session
  const initSession = async (tid: string, lang: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/patient/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tid, language: lang, consent_given: true })
      });
      const data = await res.json();
      setSessionId(data.session_id);
      setEmergencyPhone(data.emergency_phone || (tid === "CLINIC_DHAKA" ? "999" : "911"));
      setMessages([
        {
          id: "msg_welcome",
          role: "assistant",
          content: data.welcome_message,
          language: lang,
          is_emergency: false
        }
      ]);
    } catch (err) {
      console.error("Failed to init patient session:", err);
    }
  };

  useEffect(() => {
    initSession(tenantId, language);
    fetchAnalytics();
  }, [tenantId]);

  const fetchAnalytics = () => {
    fetch(`${BACKEND_URL}/api/v1/patient/analytics`)
      .then((res) => res.json())
      .then((data) => setAnalytics(data))
      .catch(() => {});
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || !sessionId || isSending) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      language: language
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText("");
    setIsSending(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/patient/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language: language })
      });
      const data = await res.json();
      const assistantMsg: Message = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: data.response_text,
        language: data.language,
        is_emergency: data.is_emergency,
        intent: data.intent,
        recommended_specialists: data.recommended_specialists,
        agentic_trace: data.agentic_trace
      };
      setMessages((prev) => [...prev, assistantMsg]);
      fetchAnalytics();
    } catch (err) {
      console.error("Message send failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: "We encountered a temporary connection issue. Please try again.",
          language: "en"
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setAuthError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/patient/auth/login?session_id=${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: authPatientId,
          mrn: authMrn,
          consent_confirmed: true
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Authentication failed");
      }
      const data = await res.json();
      setIsAuthenticated(true);
      setPatientName(data.patient_name);
      setShowAuthModal(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `auth_${Date.now()}`,
          role: "assistant",
          content: `Authenticated as ${data.patient_name} (MRN: ${authMrn}). Verified access to personal clinic records enabled.`,
          language: language
        }
      ]);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleHandoff = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/patient/chat/sessions/${sessionId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Patient requested human triage escalation in demo UI" })
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `ho_${Date.now()}`,
          role: "assistant",
          content: data.message || "Your inquiry has been escalated to our nursing staff.",
          language: language
        }
      ]);
    } catch (err) {
      console.error("Handoff trigger error:", err);
    }
  };

  const handlePurgeSession = async () => {
    if (!sessionId) return;
    await fetch(`${BACKEND_URL}/api/v1/patient/chat/sessions/${sessionId}`, { method: "DELETE" });
    setIsAuthenticated(false);
    setPatientName(null);
    initSession(tenantId, language);
  };

  const copyWidgetCode = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : (BACKEND_URL || "https://frontend-chi-seven-22.vercel.app");
    const code = `<script 
  src="${origin}/widget.js" 
  data-tenant-id="${tenantId}" 
  data-api-url="${origin}" 
  data-lang="${language}" 
  data-theme="dark">
</script>`;
    navigator.clipboard.writeText(code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-graphite-950 text-white select-none">
      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col border-r border-white/[0.08]">
        {/* Top Controls Bar */}
        <div className="p-4 border-b border-white/[0.08] bg-graphite-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <span>Patient Conversational AI Demo</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                  v4.0 Live
                </span>
              </div>
              <div className="text-[11px] text-graphite-400">Public-Facing Healthcare Assistant</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tenant Selector */}
            <select
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setLanguage(e.target.value === "CLINIC_DHAKA" ? "bn" : "en");
              }}
              className="bg-graphite-800 text-xs text-graphite-200 border border-white/[0.1] rounded-lg px-2.5 py-1.5 outline-none font-mono"
            >
              <option value="DEFAULT_HOSPITAL">Synapse University Hospital (US - 911)</option>
              <option value="CLINIC_DHAKA">Dhaka Health Center (BD - 999)</option>
            </select>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage((prev) => (prev === "en" ? "bn" : "en"))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-700 text-xs text-white border border-white/[0.08] transition-all font-mono"
            >
              <Globe className="w-3.5 h-3.5 text-clinical-blue" />
              <span>{language === "en" ? "English" : "বাংলা (Bengali)"}</span>
            </button>

            {/* Auth Status / Login */}
            {isAuthenticated ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                <UserCheck className="w-3.5 h-3.5" />
                <span>{patientName || "Verified Patient"}</span>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-700 text-graphite-300 border border-white/[0.08] text-xs transition-all font-mono"
              >
                <Lock className="w-3.5 h-3.5 text-graphite-400" />
                <span>Patient Portal Login</span>
              </button>
            )}

            <button
              onClick={handlePurgeSession}
              title="Withdraw Consent & Purge History"
              className="p-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-700 text-graphite-400 hover:text-rose-400 border border-white/[0.08] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Emergency Notice Banner */}
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>
              {language === "bn"
                ? "জরুরি চিকিৎসা প্রয়োজনে অবিলম্বে আপনার স্থানীয় জরুরি সেবায় যোগাযোগ করুন।"
                : "For acute, life-threatening symptoms, dial your emergency medical service immediately."}
            </span>
          </div>
          <a
            href={`tel:${emergencyPhone}`}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold border border-rose-500/30"
          >
            <PhoneCall className="w-3 h-3" />
            <span>Call {emergencyPhone}</span>
          </a>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-1 ${
                    isUser
                      ? "bg-clinical-blue text-white rounded-br-sm"
                      : m.is_emergency
                      ? "bg-rose-950/80 border border-rose-500/40 text-rose-100 rounded-bl-sm"
                      : "bg-graphite-900 border border-white/[0.08] text-graphite-200 rounded-bl-sm shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-graphite-400 font-mono pb-1 border-b border-white/[0.06]">
                    <span>{isUser ? "Patient (Visitor)" : "Synapse Patient AI"}</span>
                    <div className="flex items-center gap-1.5">
                      {m.agentic_trace && (
                        <span className="text-[9px] font-mono text-emerald-400">CRAG Grounded</span>
                      )}
                      {m.intent && <span className="uppercase text-[9px] text-sky-400 font-mono">{m.intent}</span>}
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* Render Recommended Specialists if returned */}
                  {!!m.recommended_specialists?.length && (
                    <div className="mt-2.5 pt-2 border-t border-white/[0.06] space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-graphite-400">
                        <span>{language === "bn" ? "প্রস্তাবিত বিশেষজ্ঞ চিকিৎসক" : "Recommended Specialists"}</span>
                        <span className="text-clinical-blue">{m.recommended_specialists.length} available</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {m.recommended_specialists.map((doc: any, idx: number) => (
                          <div
                            key={doc.id || doc.doctor_id || `doc_${idx}`}
                            className="p-2 rounded-xl bg-graphite-950/80 border border-white/[0.06] hover:border-clinical-blue/30 transition-all flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-white text-[11px] truncate flex items-center gap-1">
                                <span>{doc.name}</span>
                                {doc.bmdc_reg_no && (
                                  <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-graphite-800 text-graphite-400">
                                    {doc.bmdc_reg_no}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-clinical-blue">{doc.specialization || doc.specialty}</div>
                              <div className="text-[9px] text-graphite-400 font-mono">
                                {doc.available_schedule}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono text-[11px] font-bold text-emerald-400">
                                {doc.currency === "BDT" ? `৳ ${doc.consultation_fee}` : `$${doc.consultation_fee}`}
                              </span>
                              <div className="text-[8px] text-graphite-500 uppercase font-mono">Fee</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {isSending && (
            <div className="flex justify-start">
              <div className="p-3 rounded-xl bg-graphite-900 border border-white/[0.06] text-xs text-graphite-400 italic flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-clinical-blue animate-ping" />
                <span>
                  {language === "bn"
                    ? "মেডপালস এআই ক্লিনিক্যাল নির্দেশিকা যাচাই করছে..."
                    : "Synapse Clinical is referencing patient safety guidelines..."}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Preset Prompt Pills */}
        <div className="px-4 py-2 bg-graphite-900/50 border-t border-white/[0.04] flex flex-wrap gap-2">
          <span className="text-[10px] text-graphite-400 font-mono self-center">Test Inquiries:</span>
          <button
            onClick={() => handleSendMessage(language === "bn" ? "আমার দুই সপ্তাহ ধরে ত্বকে লাল ফুসকুড়ি এবং চুলকানি হচ্ছে।" : "I have an itchy red rash on my arm for two weeks.")}
            className="px-2.5 py-1 rounded-md bg-graphite-800 hover:bg-graphite-700 text-graphite-300 text-[11px] border border-white/[0.06] transition-all"
          >
            🩺 {language === "bn" ? "চর্মরোগ/ফুসকুড়ি (Dermatology)" : "Dermatology: Itchy Arm Rash"}
          </button>
          <button
            onClick={() => handleSendMessage(language === "bn" ? "আমার ঘন ঘন তীব্র মাইগ্রেনের মাথা ব্যথা এবং চোখে ঝাপসা লাগছে।" : "Severe recurring migraines with vision sensitivity.")}
            className="px-2.5 py-1 rounded-md bg-graphite-800 hover:bg-graphite-700 text-graphite-300 text-[11px] border border-white/[0.06] transition-all"
          >
            🧠 {language === "bn" ? "মাইগ্রেন/স্নায়ুরোগ (Neurology)" : "Neurology: Recurring Migraines"}
          </button>
          <button
            onClick={() => handleSendMessage(language === "bn" ? "আমার বুকে তীব্র চাপ ও ব্যথা এবং শ্বাস নিতে পারছি না।" : "I have persistent chest discomfort and shortness of breath.")}
            className="px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] border border-rose-500/20 transition-all font-medium"
          >
            🚨 {language === "bn" ? "জরুরি বুকে ব্যথা (Cardio/ER)" : "Emergency: Chest Discomfort"}
          </button>
          <button
            onClick={() => handleSendMessage(language === "bn" ? "মেটফরমিন কীভাবে খেতে হয় এবং এর পার্শ্বপ্রতিক্রিয়া কী?" : "What are the common side effects of Metformin and should I take it with food?")}
            className="px-2.5 py-1 rounded-md bg-graphite-800 hover:bg-graphite-700 text-graphite-300 text-[11px] border border-white/[0.06] transition-all"
          >
            💊 {language === "bn" ? "মেটফরমিনের নিয়মাবলী" : "Metformin Safety Guide"}
          </button>
          <button
            onClick={() => handleSendMessage(language === "bn" ? "আমি একজন ক্লিনিক্যাল নার্স বা ডাক্তারের সাথে কথা বলতে চাই।" : "I need to talk to a human clinic nurse please.")}
            className="px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] border border-amber-500/20 transition-all"
          >
            👩‍⚕️ {language === "bn" ? "নার্স সহায়তা অনুরোধ" : "Request Human Nurse"}
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-white/[0.08] bg-graphite-900 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={
              language === "bn"
                ? "স্বাস্থ্য জিজ্ঞাসা, ওষুধের তথ্য বা অ্যাপয়েন্টমেন্ট সম্পর্কে লিখুন..."
                : "Ask about symptoms, medication safety, or clinic routing..."
            }
            className="flex-1 bg-graphite-950 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-graphite-500 outline-none focus:border-clinical-blue transition-all"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isSending}
            className="px-4 py-2.5 rounded-xl bg-clinical-blue hover:bg-clinical-blue/90 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </div>

      {/* Side Analytics & Widget Integration Panel */}
      <div className="w-80 border-l border-white/[0.08] bg-graphite-900/60 p-4 space-y-5 overflow-y-auto hidden lg:block">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-graphite-400 font-mono">
            Patient Agent Telemetry
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-graphite-850 border border-white/[0.06] space-y-1">
              <div className="text-[10px] text-graphite-400 font-mono">Sessions</div>
              <div className="text-lg font-bold font-mono text-white tabular-nums">{analytics.total_sessions}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-graphite-850 border border-white/[0.06] space-y-1">
              <div className="text-[10px] text-graphite-400 font-mono">Messages</div>
              <div className="text-lg font-bold font-mono text-white tabular-nums">{analytics.total_messages}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-graphite-850 border border-white/[0.06] space-y-1">
              <div className="text-[10px] text-graphite-400 font-mono">Escalations</div>
              <div className="text-lg font-bold font-mono text-amber-400 tabular-nums">{analytics.escalation_rate_pct}%</div>
            </div>
            <div className="p-2.5 rounded-xl bg-graphite-850 border border-white/[0.06] space-y-1">
              <div className="text-[10px] text-graphite-400 font-mono">Avg Latency</div>
              <div className="text-lg font-bold font-mono text-clinical-blue tabular-nums">{analytics.average_latency_ms}ms</div>
            </div>
          </div>
        </div>

        {/* Language Breakdown */}
        <div className="p-3 rounded-xl bg-graphite-850 border border-white/[0.06] space-y-2">
          <div className="text-[11px] font-semibold text-white">Language Distribution</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-graphite-300 font-mono">
              <span>English (US/UK)</span>
              <span>{analytics.language_distribution?.en || 34}</span>
            </div>
            <div className="w-full bg-graphite-900 h-1.5 rounded-full overflow-hidden">
              <div className="bg-clinical-blue h-full" style={{ width: "65%" }} />
            </div>
            <div className="flex justify-between text-graphite-300 font-mono pt-1">
              <span>বাংলা (Bengali)</span>
              <span>{analytics.language_distribution?.bn || 18}</span>
            </div>
            <div className="w-full bg-graphite-900 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-400 h-full" style={{ width: "35%" }} />
            </div>
          </div>
        </div>

        {/* Embeddable Widget Snippet */}
        <div className="p-3.5 rounded-xl bg-graphite-850 border border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Code className="w-3.5 h-3.5 text-sky-400" />
              <span>Embed Widget</span>
            </div>
            <button
              onClick={copyWidgetCode}
              className="flex items-center gap-1 text-[10px] text-clinical-blue hover:text-sky-300 font-mono"
            >
              {copiedSnippet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSnippet ? "Copied" : "Copy Tag"}</span>
            </button>
          </div>
          <p className="text-[11px] text-graphite-400">
            Paste into any website footer or WordPress template to embed the patient assistant floating bubble:
          </p>
          <pre className="p-2.5 rounded-lg bg-graphite-950 text-[10px] font-mono text-graphite-300 overflow-x-auto border border-white/[0.04]">
{`<script 
  src="${typeof window !== "undefined" ? window.location.origin : "https://frontend-chi-seven-22.vercel.app"}/widget.js" 
  data-tenant-id="${tenantId}" 
  data-api-url="${typeof window !== "undefined" ? window.location.origin : "https://frontend-chi-seven-22.vercel.app"}"
  data-lang="${language}">
</script>`}
          </pre>
        </div>

        {/* Safety Boundary Summary */}
        <div className="p-3 rounded-xl bg-graphite-850/60 border border-white/[0.06] space-y-1.5 text-xs text-graphite-400">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Patient Safety Sandbox</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Patient Agent runs in a restricted sandbox isolated from EHR write operations, SQL queries, and clinical calculators.
            All responses carry mandatory regulatory disclaimers.
          </p>
        </div>
      </div>

      {/* Patient Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-graphite-900 border border-white/[0.1] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-clinical-blue" />
                <h3 className="text-sm font-semibold text-white">Patient Portal Authentication</h3>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="text-graphite-400 hover:text-white">&times;</button>
            </div>
            <p className="text-xs text-graphite-300">
              To view confidential health records and personalized medication lists, verify your Patient ID and Medical Record Number (MRN).
            </p>
            {authError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
                {authError}
              </div>
            )}
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-graphite-400">Patient ID</label>
                <input
                  type="text"
                  value={authPatientId}
                  onChange={(e) => setAuthPatientId(e.target.value)}
                  className="w-full mt-1 bg-graphite-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                  placeholder="e.g. P101"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-graphite-400">Medical Record Number (MRN)</label>
                <input
                  type="text"
                  value={authMrn}
                  onChange={(e) => setAuthMrn(e.target.value)}
                  className="w-full mt-1 bg-graphite-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                  placeholder="e.g. MRN-882190"
                  required
                />
              </div>
              <div className="text-[10px] text-graphite-400 leading-relaxed">
                By logging in, you authorize Synapse Clinical to access synthetic records for Eleanor Vance (P101) under research consent.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-graphite-800 text-xs text-graphite-300 hover:bg-graphite-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-clinical-blue hover:bg-clinical-blue/90 text-xs font-medium text-white shadow-md"
                >
                  Confirm & Link Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
