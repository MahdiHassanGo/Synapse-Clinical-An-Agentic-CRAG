"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  X,
  Stethoscope,
  Send,
  Globe,
  Clock,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  Sparkles,
  PhoneCall
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export interface ChatDoctor {
  id: string;
  name: string;
  specialization: string;
  department: string;
  qualifications: string;
  experience_years?: number;
  consultation_fee: number;
  currency: string;
  available_schedule: string;
  bmdc_reg_no?: string;
  bio?: string;
  relevance_score?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  language?: string;
  is_emergency?: boolean;
  recommended_specialists?: ChatDoctor[];
  agentic_trace?: {
    emergency_screened?: boolean;
    is_emergency?: boolean;
    crag_specialist_match_count?: number;
    top_specialty?: string;
    mean_relevance_score?: number;
  };
}

const SUGGESTED_QUERIES_EN = [
  "I have persistent chest discomfort and shortness of breath",
  "I have an itchy red rash on my arm for two weeks",
  "Severe recurring migraines with vision sensitivity"
];

const SUGGESTED_QUERIES_BN = [
  "আমার দুই সপ্তাহ ধরে ত্বকে লাল ফুসকুড়ি এবং তীব্র চুলকানি হচ্ছে",
  "আমার ঘন ঘন তীব্র মাইগ্রেনের মাথা ব্যথা এবং চোখে ঝাপসা লাগছে",
  "আমার বুকে তীব্র ব্যথা এবং শ্বাসকষ্ট হচ্ছে"
];

export function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [tenantId, setTenantId] = useState<string>("CLINIC_DHAKA");
  const [language, setLanguage] = useState<string>("en");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [emergencyPhone, setEmergencyPhone] = useState<string>("999");
  const [bookedDoctor, setBookedDoctor] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Global event listener to open chat from anywhere
  useEffect(() => {
    const handleOpenChat = () => setIsOpen(true);
    window.addEventListener("open-synapse-chat", handleOpenChat);
    return () => window.removeEventListener("open-synapse-chat", handleOpenChat);
  }, []);

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current && isOpen) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isSending, isOpen]);

  // Auto focus input
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Initialize session on mount or tenant change
  const initSession = async (tid: string, lang: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/patient/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tid, language: lang, consent_given: true })
      });
      if (res.ok) {
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
      }
    } catch (err) {
      console.error("Failed to init floating chat session:", err);
    }
  };

  useEffect(() => {
    initSession(tenantId, language);
  }, [tenantId]);

  const sendMessage = async (overrideText?: string) => {
    const content = (overrideText ?? input).trim();
    if (!content || !sessionId || isSending) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/patient/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, language })
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: data.response_text,
          language: data.language,
          is_emergency: data.is_emergency,
          recommended_specialists: data.recommended_specialists,
          agentic_trace: data.agentic_trace
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error("Failed to send message");
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: "Could not connect to hospital clinical triage service. Please try again.",
          language: "en"
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleBookSlot = (doctor: ChatDoctor) => {
    setBookedDoctor(doctor.name);
    setTimeout(() => setBookedDoctor(null), 3500);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed right-6 bottom-6 z-50 w-14 h-14 rounded-xl bg-accent hover:bg-accent-hover text-white shadow-lg border border-accent-hover/20 flex items-center justify-center transition-colors cursor-pointer"
        aria-label={isOpen ? "Close clinical triage" : "Open hospital clinical triage"}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <Stethoscope className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-accent" aria-hidden="true" />
          </div>
        )}
      </button>

      {/* Expandable Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Synapse Hospital Clinical Triage Navigator"
          className="fixed right-6 bottom-24 z-50 flex flex-col overflow-hidden rounded-xl border border-hairline bg-canvas text-ink shadow-xl w-[min(26rem,calc(100vw-2rem))] h-[min(38rem,calc(100dvh-7rem))] font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-hairline bg-surface px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent border border-accent-border">
                <Stethoscope className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold text-xs text-ink">
                    {tenantId === "CLINIC_DHAKA"
                      ? "Bangladesh Specialized Hospital"
                      : "Metropolitan Academic Medical"}
                  </p>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent-soft text-accent border border-accent-border shrink-0">
                    RAG
                  </span>
                </div>
                <p className="truncate text-[11px] text-ink-muted">
                  Department &amp; Specialist Matching
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setLanguage((prev) => (prev === "en" ? "bn" : "en"))}
                className="px-2 py-1 rounded-md bg-subtle hover:bg-muted text-[11px] font-mono text-ink-secondary hover:text-ink border border-hairline flex items-center gap-1 transition-colors cursor-pointer"
                title="Switch Language"
              >
                <Globe className="w-3 h-3 text-accent" />
                <span>{language === "en" ? "বাংলা" : "English"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Booking Confirmation Toast */}
          {bookedDoctor && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-2 text-xs text-clinical-emerald flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Consultation appointment hold requested with <strong>{bookedDoctor}</strong>.
              </span>
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={scrollAreaRef}
            className="flex-1 space-y-3.5 overflow-y-auto p-4 bg-canvas"
          >
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                language={language}
                onBookSlot={handleBookSlot}
              />
            ))}

            {messages.length === 1 && !isSending && (
              <div className="space-y-2 pt-2">
                <p className="text-[11px] font-medium text-ink-muted">
                  {language === "bn" ? "প্রস্তাবিত জিজ্ঞাসা সমূহ:" : "Suggested symptom inquiries:"}
                </p>
                <div className="space-y-1.5">
                  {(language === "bn" ? SUGGESTED_QUERIES_BN : SUGGESTED_QUERIES_EN).map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="w-full rounded-lg border border-hairline bg-surface hover:bg-subtle hover:border-accent-border px-3 py-2 text-left text-xs text-ink-secondary hover:text-ink transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <span className="line-clamp-2 leading-snug">{q}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-accent shrink-0 ml-1.5 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isSending && (
              <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface p-3 text-xs text-ink-secondary">
                <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
                <span>
                  {language === "bn"
                    ? "হাসপাতালের স্পেশালিস্ট ডিরেক্টরি ও ক্লিনিক্যাল গাইডলাইন যাচাই করা হচ্ছে…"
                    : "Checking hospital clinical directory & verified specialists…"}
                </span>
              </div>
            )}
          </div>

          {/* Input & Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="border-t border-hairline bg-surface p-2.5 shrink-0"
          >
            <div className="flex items-end gap-1.5">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={
                  language === "bn"
                    ? "উপসর্গ লিখুন (যেমন: বুকে ব্যথা, মাইগ্রেন, ত্বকে ফুসকুড়ি)…"
                    : "Describe symptoms (e.g., chest pain, migraine, skin rash)…"
                }
                rows={2}
                className="flex-1 max-h-28 min-h-[44px] resize-none rounded-lg bg-subtle border border-hairline px-3 py-2.5 text-xs leading-snug text-ink placeholder-ink-muted outline-none focus:border-accent transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="w-11 h-11 shrink-0 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Send query"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-2 pt-2 border-t border-hairline flex items-center justify-between text-[11px] text-ink-muted">
              <span className="truncate">
                {language === "bn"
                  ? "জরুরি চিকিৎসা সহায়তা:"
                  : "Guidance only. Emergency hotline:"}
              </span>
              <a
                href={`tel:${emergencyPhone}`}
                className="font-mono font-semibold text-clinical-rose hover:underline flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-200"
              >
                <PhoneCall className="w-3 h-3" />
                <span>{tenantId === "CLINIC_DHAKA" ? "10633 / 999" : emergencyPhone}</span>
              </a>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function ChatBubble({
  message,
  language,
  onBookSlot
}: {
  message: ChatMessage;
  language: string;
  onBookSlot: (doctor: ChatDoctor) => void;
}) {
  const isUser = message.role === "user";
  const isEmergency = message.is_emergency;

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`rounded-xl text-xs leading-relaxed max-w-[90%] ${
          isUser
            ? "bg-accent text-white px-3.5 py-2.5 rounded-br-sm"
            : isEmergency
            ? "bg-red-50 border border-red-200 text-clinical-rose p-3.5 rounded-bl-sm"
            : "bg-surface border border-hairline text-ink p-3.5 rounded-bl-sm"
        }`}
      >
        {!isUser && (
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-hairline text-[11px] font-mono">
            <span className="flex items-center gap-1 text-accent font-semibold">
              <Stethoscope className="w-3 h-3" />
              <span>Synapse Navigator</span>
            </span>
            {message.agentic_trace && (
              <span className="text-clinical-emerald flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3" />
                <span>CRAG Grounded</span>
              </span>
            )}
          </div>
        )}

        <div className="whitespace-pre-wrap break-words leading-relaxed text-xs">
          {message.content}
        </div>

        {!!message.recommended_specialists?.length && (
          <div className="mt-3 pt-2.5 border-t border-hairline space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-ink-muted">
              <span>{language === "bn" ? "প্রস্তাবিত বিশেষজ্ঞ চিকিৎসক" : "Recommended specialists"}</span>
              <span className="text-accent font-mono font-semibold">
                {message.recommended_specialists.length} available
              </span>
            </div>

            <div className="space-y-2">
              {message.recommended_specialists.map((doctor: any, idx: number) => {
                const feeText =
                  doctor.currency === "BDT"
                    ? `৳ ${Number(doctor.consultation_fee ?? 1000).toLocaleString()}`
                    : `$${Number(doctor.consultation_fee ?? 50).toLocaleString()}`;

                return (
                  <div
                    key={doctor.id || doctor.doctor_id || `doc_${idx}`}
                    className="p-2.5 rounded-lg bg-subtle border border-hairline hover:border-accent-border transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink text-xs truncate flex items-center gap-1">
                          <span>{doctor.name}</span>
                          {doctor.bmdc_reg_no && (
                            <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface text-ink-muted border border-hairline">
                              {doctor.bmdc_reg_no}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-accent font-medium mt-0.5">
                          {doctor.specialization || doctor.specialty}
                        </div>
                        <div className="text-[11px] text-ink-muted line-clamp-1 mt-0.5">
                          {doctor.qualifications}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-clinical-emerald text-xs tabular-nums">
                          {feeText}
                        </div>
                        <div className="text-[10px] font-mono text-ink-muted">
                          Fee
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-hairline text-[11px]">
                      <div className="flex items-center gap-1 text-ink-secondary font-mono">
                        <Clock className="w-3 h-3 text-clinical-amber" />
                        <span className="truncate max-w-[140px]">{doctor.available_schedule}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onBookSlot(doctor)}
                        className="px-2.5 py-1 rounded-md bg-accent hover:bg-accent-hover text-white font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Book Slot</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
