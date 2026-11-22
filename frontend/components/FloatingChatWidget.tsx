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
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed right-6 bottom-6 z-50 w-14 h-14 rounded-2xl bg-clinical-blue hover:bg-clinical-blue/90 text-white shadow-2xl shadow-clinical-blue/30 border border-white/20 flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-clinical-blue"
        aria-label={isOpen ? "Close clinical triage" : "Open hospital clinical triage"}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <Stethoscope className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
          </div>
        )}
      </button>

      {/* Expandable Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Synapse Hospital Clinical Triage Navigator"
          className="fixed right-6 bottom-24 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-graphite-950 text-white shadow-2xl w-[min(26rem,calc(100vw-2rem))] h-[min(38rem,calc(100dvh-7rem))] font-sans animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-graphite-900 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-clinical-blue/15 text-clinical-blue border border-clinical-blue/20">
                <Stethoscope className="size-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold text-xs text-white">
                    {tenantId === "CLINIC_DHAKA"
                      ? "Bangladesh Specialized Hospital"
                      : "Metropolitan Academic Medical"}
                  </p>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-clinical-blue/15 text-clinical-blue border border-clinical-blue/30">
                    Agentic RAG
                  </span>
                </div>
                <p className="truncate text-[10px] text-graphite-400">
                  Department &amp; Specialist Matching
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language Switcher */}
              <button
                onClick={() => setLanguage((prev) => (prev === "en" ? "bn" : "en"))}
                className="px-2 py-1 rounded-md bg-graphite-800 hover:bg-graphite-750 text-[10px] font-mono text-graphite-300 hover:text-white border border-white/[0.06] flex items-center gap-1 transition-colors"
                title="Switch Language"
              >
                <Globe className="w-3 h-3 text-clinical-blue" />
                <span>{language === "en" ? "বাংলা" : "English"}</span>
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-graphite-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Booking Confirmation Toast */}
          {bookedDoctor && (
            <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-3 py-1.5 text-[11px] text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Consultation appointment hold requested with <strong>{bookedDoctor}</strong>!
              </span>
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={scrollAreaRef}
            className="flex-1 space-y-3.5 overflow-y-auto p-4 bg-graphite-950/80"
          >
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                language={language}
                onBookSlot={handleBookSlot}
              />
            ))}

            {/* Suggested Queries if only welcome message */}
            {messages.length === 1 && !isSending && (
              <div className="space-y-2 pt-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-graphite-500">
                  {language === "bn" ? "প্রস্তাবিত জিজ্ঞাসা সমূহ:" : "Suggested Symptom Inquiries:"}
                </p>
                <div className="space-y-1.5">
                  {(language === "bn" ? SUGGESTED_QUERIES_BN : SUGGESTED_QUERIES_EN).map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="w-full rounded-xl border border-white/[0.08] bg-graphite-900/90 hover:bg-graphite-850 hover:border-clinical-blue/40 px-3 py-2 text-left text-[11px] text-graphite-300 hover:text-white transition-all shadow-sm flex items-center justify-between group"
                    >
                      <span className="line-clamp-2 leading-snug">{q}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-graphite-500 group-hover:text-clinical-blue shrink-0 ml-1.5 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isSending && (
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-graphite-900 p-3 text-xs text-graphite-400">
                <div className="w-2 h-2 rounded-full bg-clinical-blue animate-ping" />
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
            className="border-t border-white/[0.08] bg-graphite-900 p-2.5 shrink-0"
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
                rows={1}
                className="flex-1 max-h-24 min-h-9 resize-none rounded-xl bg-graphite-950 border border-white/[0.08] px-3 py-2 text-xs text-white placeholder-graphite-500 outline-none focus:border-clinical-blue transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="size-9 shrink-0 rounded-xl bg-clinical-blue hover:bg-clinical-blue/90 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-sm focus:outline-none"
                aria-label="Send query"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Emergency Hotline Banner */}
            <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-graphite-400">
              <span className="truncate">
                {language === "bn"
                  ? "জরুরি চিকিৎসা সহায়তা:"
                  : "Guidance only. Emergency Hotline:"}
              </span>
              <a
                href={`tel:${emergencyPhone}`}
                className="font-mono font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20"
              >
                <PhoneCall className="w-2.5 h-2.5" />
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
        className={`rounded-2xl text-xs leading-relaxed max-w-[90%] shadow-lg ${
          isUser
            ? "bg-clinical-blue text-white px-3.5 py-2.5 rounded-br-sm"
            : isEmergency
            ? "bg-rose-950/80 border border-rose-500/40 text-rose-100 p-3.5 rounded-bl-sm"
            : "bg-graphite-900 border border-white/[0.08] text-graphite-200 p-3.5 rounded-bl-sm"
        }`}
      >
        {/* Assistant Header & Verification Badge */}
        {!isUser && (
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06] text-[10px] font-mono">
            <span className="flex items-center gap-1 text-clinical-blue font-semibold">
              <Stethoscope className="w-3 h-3" />
              <span>Synapse Navigator</span>
            </span>
            {message.agentic_trace && (
              <span className="text-emerald-400 flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3" />
                <span>CRAG Grounded</span>
              </span>
            )}
          </div>
        )}

        {/* Message Content */}
        <div className="whitespace-pre-wrap break-words leading-relaxed text-[11.5px]">
          {message.content}
        </div>

        {/* Recommended Specialists Cards */}
        {!!message.recommended_specialists?.length && (
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-graphite-400">
              <span>{language === "bn" ? "প্রস্তাবিত বিশেষজ্ঞ চিকিৎসক" : "Recommended Specialists"}</span>
              <span className="text-clinical-blue font-semibold">
                {message.recommended_specialists.length} available
              </span>
            </div>

            <div className="space-y-2">
              {message.recommended_specialists.map((doctor) => {
                const feeText =
                  doctor.currency === "BDT"
                    ? `৳ ${Number(doctor.consultation_fee).toLocaleString()}`
                    : `$${Number(doctor.consultation_fee).toLocaleString()}`;

                return (
                  <div
                    key={doctor.id}
                    className="p-2.5 rounded-xl bg-graphite-950/80 border border-white/[0.08] hover:border-clinical-blue/40 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-[11.5px] truncate flex items-center gap-1">
                          <span>{doctor.name}</span>
                          {doctor.bmdc_reg_no && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-graphite-800 text-graphite-400 border border-white/[0.04]">
                              {doctor.bmdc_reg_no}
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-clinical-blue font-medium mt-0.5">
                          {doctor.specialization}
                        </div>
                        <div className="text-[10px] text-graphite-400 line-clamp-1 mt-0.5">
                          {doctor.qualifications}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-emerald-400 text-xs">
                          {feeText}
                        </div>
                        <div className="text-[9px] font-mono text-graphite-500 uppercase">
                          Consultation Fee
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.04] text-[10px]">
                      <div className="flex items-center gap-1 text-graphite-300 font-mono">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span className="truncate max-w-[140px]">{doctor.available_schedule}</span>
                      </div>

                      <button
                        onClick={() => onBookSlot(doctor)}
                        className="px-2.5 py-1 rounded-lg bg-clinical-blue hover:bg-clinical-blue/90 text-white font-medium flex items-center gap-1 transition-colors shadow-sm"
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
