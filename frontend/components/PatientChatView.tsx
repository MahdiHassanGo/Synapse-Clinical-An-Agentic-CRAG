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
  User,
  Stethoscope,
  Brain,
  Pill,
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
    <div className="flex-1 flex overflow-hidden bg-canvas text-ink">
      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col border-r border-hairline min-w-0">
        {/* Top Controls Bar */}
        <div className="p-4 border-b border-hairline bg-surface flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-soft border border-accent-border flex items-center justify-center text-accent">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink flex items-center gap-2">
                <span>Patient Conversational AI Demo</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent-soft text-accent border border-accent-border font-mono">
                  Live
                </span>
              </div>
              <div className="text-xs text-ink-muted">Public-facing healthcare navigator</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setLanguage(e.target.value === "CLINIC_DHAKA" ? "bn" : "en");
              }}
              aria-label="Select hospital tenant"
              className="bg-subtle text-xs text-ink border border-hairline rounded-lg px-2.5 py-1.5 outline-none font-mono cursor-pointer"
            >
              <option value="DEFAULT_HOSPITAL">Synapse University Hospital (US - 911)</option>
              <option value="CLINIC_DHAKA">Dhaka Health Center (BD - 999)</option>
            </select>

            <button
              type="button"
              onClick={() => setLanguage((prev) => (prev === "en" ? "bn" : "en"))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-subtle hover:bg-muted text-xs text-ink border border-hairline transition-colors font-mono cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-accent" />
              <span>{language === "en" ? "English" : "বাংলা (Bengali)"}</span>
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-clinical-emerald text-xs font-mono">
                <UserCheck className="w-3.5 h-3.5" />
                <span>{patientName || "Verified Patient"}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-subtle hover:bg-muted text-ink-secondary hover:text-ink border border-hairline text-xs transition-colors font-mono cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-ink-muted" />
                <span>Patient Portal Login</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePurgeSession}
              title="Withdraw Consent & Purge History"
              aria-label="Purge chat session"
              className="p-2 rounded-lg bg-subtle hover:bg-red-50 text-ink-muted hover:text-clinical-rose border border-hairline transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Emergency Notice Banner */}
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-clinical-rose">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {language === "bn"
                ? "জরুরি চিকিৎসা প্রয়োজনে অবিলম্বে আপনার স্থানীয় জরুরি সেবায় যোগাযোগ করুন।"
                : "For acute, life-threatening symptoms, dial your emergency medical service immediately."}
            </span>
          </div>
          <a
            href={`tel:${emergencyPhone}`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-clinical-rose hover:bg-red-800 text-white text-xs font-semibold transition-colors"
          >
            <PhoneCall className="w-3 h-3" />
            <span>Call {emergencyPhone}</span>
          </a>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-canvas">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3 text-xs leading-relaxed space-y-1.5 ${
                    isUser
                      ? "bg-accent text-white rounded-br-sm"
                      : m.is_emergency
                      ? "bg-red-50 border border-red-200 text-clinical-rose rounded-bl-sm"
                      : "bg-surface border border-hairline text-ink rounded-bl-sm"
                  }`}
                >
                  <div
                    className={`flex items-center justify-between gap-4 text-[11px] font-mono pb-1.5 border-b ${
                      isUser ? "border-white/20 text-white/90" : "border-hairline text-ink-muted"
                    }`}
                  >
                    <span>{isUser ? "Patient (Visitor)" : "Synapse Patient AI"}</span>
                    <div className="flex items-center gap-1.5">
                      {m.agentic_trace && (
                        <span className={isUser ? "text-white" : "text-clinical-emerald font-medium"}>
                          CRAG Grounded
                        </span>
                      )}
                      {m.intent && (
                        <span className={isUser ? "text-white/90" : "text-accent"}>
                          {m.intent}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</div>

                  {!!m.recommended_specialists?.length && (
                    <div className="mt-2.5 pt-2.5 border-t border-hairline space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted">
                        <span>{language === "bn" ? "প্রস্তাবিত বিশেষজ্ঞ চিকিৎসক" : "Recommended specialists"}</span>
                        <span className="text-accent font-mono">{m.recommended_specialists.length} available</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {m.recommended_specialists.map((doc: any, idx: number) => (
                          <div
                            key={doc.id || doc.doctor_id || `doc_${idx}`}
                            className="p-2.5 rounded-lg bg-subtle border border-hairline hover:border-accent-border transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-ink text-xs truncate flex items-center gap-1.5">
                                <span>{doc.name}</span>
                                {doc.bmdc_reg_no && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface text-ink-muted border border-hairline">
                                    {doc.bmdc_reg_no}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-accent font-medium">{doc.specialization || doc.specialty}</div>
                              <div className="text-[11px] text-ink-muted font-mono">
                                {doc.available_schedule}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono text-xs font-bold text-clinical-emerald tabular-nums">
                                {doc.currency === "BDT" ? `৳ ${doc.consultation_fee}` : `$${doc.consultation_fee}`}
                              </span>
                              <div className="text-[10px] text-ink-muted font-mono">Fee</div>
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
              <div className="p-3 rounded-xl bg-surface border border-hairline text-xs text-ink-secondary flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
                <span>
                  {language === "bn"
                    ? "সিন্যাপ্স ক্লিনিক্যাল নির্দেশিকা যাচাই করছে..."
                    : "Synapse Clinical is referencing patient safety guidelines..."}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Preset Prompt Pills — Clean Line Icons, Zero Emoji */}
        <div className="px-4 py-2.5 bg-surface border-t border-hairline flex flex-wrap gap-2">
          <span className="text-[11px] text-ink-muted font-mono self-center">Test inquiries:</span>
          <button
            type="button"
            onClick={() => handleSendMessage(language === "bn" ? "আমার দুই সপ্তাহ ধরে ত্বকে লাল ফুসকুড়ি এবং চুলকানি হচ্ছে।" : "I have an itchy red rash on my arm for two weeks.")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-subtle hover:bg-muted text-ink-secondary hover:text-ink text-xs border border-hairline transition-colors cursor-pointer"
          >
            <Stethoscope className="w-3.5 h-3.5 text-accent" />
            <span>{language === "bn" ? "চর্মরোগ/ফুসকুড়ি (Dermatology)" : "Dermatology: Itchy Arm Rash"}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage(language === "bn" ? "আমার ঘন ঘন তীব্র মাইগ্রেনের মাথা ব্যথা এবং চোখে ঝাপসা লাগছে।" : "Severe recurring migraines with vision sensitivity.")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-subtle hover:bg-muted text-ink-secondary hover:text-ink text-xs border border-hairline transition-colors cursor-pointer"
          >
            <Brain className="w-3.5 h-3.5 text-accent" />
            <span>{language === "bn" ? "মাইগ্রেন/স্নায়ুরোগ (Neurology)" : "Neurology: Recurring Migraines"}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage(language === "bn" ? "আমার বুকে তীব্র চাপ ও ব্যথা এবং শ্বাস নিতে পারছি না।" : "I have persistent chest discomfort and shortness of breath.")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-clinical-rose text-xs border border-red-200 transition-colors font-medium cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{language === "bn" ? "জরুরি বুকে ব্যথা (Cardio/ER)" : "Emergency: Chest Discomfort"}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage(language === "bn" ? "মেটফরমিন কীভাবে খেতে হয় এবং এর পার্শ্বপ্রতিক্রিয়া কী?" : "What are the common side effects of Metformin and should I take it with food?")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-subtle hover:bg-muted text-ink-secondary hover:text-ink text-xs border border-hairline transition-colors cursor-pointer"
          >
            <Pill className="w-3.5 h-3.5 text-accent" />
            <span>{language === "bn" ? "মেটফরমিনের নিয়মাবলী" : "Metformin Safety Guide"}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSendMessage(language === "bn" ? "আমি একজন ক্লিনিক্যাল নার্স বা ডাক্তারের সাথে কথা বলতে চাই।" : "I need to talk to a human clinic nurse please.")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-clinical-amber text-xs border border-amber-200 transition-colors cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{language === "bn" ? "নার্স সহায়তা অনুরোধ" : "Request Human Nurse"}</span>
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-hairline bg-surface flex items-center gap-2">
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
            className="flex-1 bg-subtle border border-hairline rounded-lg px-3.5 py-2.5 text-xs text-ink placeholder-ink-muted outline-none focus:border-accent transition-colors"
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isSending}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </div>

      {/* Side Analytics & Widget Integration Panel */}
      <div className="w-80 border-l border-hairline bg-surface p-4 space-y-5 overflow-y-auto hidden lg:block">
        <div>
          <h3 className="text-xs font-semibold text-ink">
            Patient Agent Telemetry
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-subtle border border-hairline space-y-1">
              <div className="text-[11px] text-ink-muted font-mono">Sessions</div>
              <div className="text-lg font-bold font-mono text-ink tabular-nums">
                {analytics.active_sessions ?? analytics.total_sessions ?? 42}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-subtle border border-hairline space-y-1">
              <div className="text-[11px] text-ink-muted font-mono">Messages</div>
              <div className="text-lg font-bold font-mono text-ink tabular-nums">
                {analytics.total_messages ?? 384}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-subtle border border-hairline space-y-1">
              <div className="text-[11px] text-ink-muted font-mono">Escalations</div>
              <div className="text-lg font-bold font-mono text-clinical-amber tabular-nums">
                {analytics.emergency_redirects ?? analytics.escalation_rate_pct ?? 14}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-subtle border border-hairline space-y-1">
              <div className="text-[11px] text-ink-muted font-mono">Avg Latency</div>
              <div className="text-lg font-bold font-mono text-accent tabular-nums">
                {Math.round(analytics.avg_latency_ms ?? analytics.average_latency_ms ?? 38)}ms
              </div>
            </div>
          </div>
        </div>

        {/* Language Breakdown */}
        <div className="p-3.5 rounded-xl bg-subtle border border-hairline space-y-2.5">
          <div className="text-xs font-semibold text-ink">Language Distribution</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-ink-secondary font-mono">
              <span>English (US/UK)</span>
              <span className="tabular-nums">{analytics.language_breakdown?.en ?? analytics.language_distribution?.en ?? 280}</span>
            </div>
            <div className="w-full bg-surface h-2 rounded-full overflow-hidden border border-hairline">
              <div className="bg-accent h-full" style={{ width: "72%" }} />
            </div>
            <div className="flex justify-between text-ink-secondary font-mono pt-1">
              <span>বাংলা (Bengali)</span>
              <span className="tabular-nums">{analytics.language_breakdown?.bn ?? analytics.language_distribution?.bn ?? 104}</span>
            </div>
            <div className="w-full bg-surface h-2 rounded-full overflow-hidden border border-hairline">
              <div className="bg-clinical-blue h-full" style={{ width: "28%" }} />
            </div>
          </div>
        </div>

        {/* Embeddable Widget Snippet */}
        <div className="p-3.5 rounded-xl bg-subtle border border-hairline space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Code className="w-3.5 h-3.5 text-accent" />
              <span>Embed Widget</span>
            </div>
            <button
              type="button"
              onClick={copyWidgetCode}
              className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover font-mono cursor-pointer"
            >
              {copiedSnippet ? <Check className="w-3 h-3 text-clinical-emerald" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSnippet ? "Copied" : "Copy Tag"}</span>
            </button>
          </div>
          <p className="text-xs text-ink-secondary">
            Paste into any website footer or template to embed the patient assistant floating launcher:
          </p>
          <pre className="p-2.5 rounded-lg bg-surface text-[11px] font-mono text-ink-secondary overflow-x-auto border border-hairline">
{`<script 
  src="${typeof window !== "undefined" ? window.location.origin : "https://frontend-chi-seven-22.vercel.app"}/widget.js" 
  data-tenant-id="${tenantId}" 
  data-api-url="${typeof window !== "undefined" ? window.location.origin : "https://frontend-chi-seven-22.vercel.app"}"
  data-lang="${language}">
</script>`}
          </pre>
        </div>

        {/* Safety Boundary Summary */}
        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5 text-xs text-ink-secondary">
          <div className="font-semibold text-clinical-emerald flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Patient Safety Sandbox</span>
          </div>
          <p className="text-xs leading-relaxed">
            Patient Agent runs in a restricted sandbox isolated from EHR write operations, SQL queries, and clinical calculators.
          </p>
        </div>
      </div>

      {/* Patient Auth Modal */}
      {showAuthModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Patient Portal Authentication"
          className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-surface border border-hairline p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-ink">Patient Portal Authentication</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-ink-muted hover:text-ink px-1.5 py-0.5 rounded cursor-pointer"
                aria-label="Close login dialog"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-ink-secondary">
              Verify your Patient ID and Medical Record Number (MRN) to inspect synthetic records.
            </p>
            {authError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-clinical-rose text-xs font-mono">
                {authError}
              </div>
            )}
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-secondary">Patient ID</label>
                <input
                  type="text"
                  value={authPatientId}
                  onChange={(e) => setAuthPatientId(e.target.value)}
                  className="w-full mt-1 bg-subtle border border-strong rounded-lg px-3 py-2 text-xs text-ink font-mono outline-none focus:border-accent"
                  placeholder="e.g. P101"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-secondary">Medical Record Number (MRN)</label>
                <input
                  type="text"
                  value={authMrn}
                  onChange={(e) => setAuthMrn(e.target.value)}
                  className="w-full mt-1 bg-subtle border border-strong rounded-lg px-3 py-2 text-xs text-ink font-mono outline-none focus:border-accent"
                  placeholder="e.g. MRN-882190"
                  required
                />
              </div>
              <div className="text-[11px] text-ink-muted leading-relaxed">
                By logging in, you authorize Synapse Clinical to access synthetic records under research consent.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="px-3 py-2 rounded-lg bg-subtle text-xs text-ink-secondary hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-xs font-semibold text-white cursor-pointer"
                >
                  Confirm &amp; Link Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
