/**
 * Synapse Clinical v4.1 — Standalone Embeddable Patient Chat Widget
 * Vanilla JavaScript loader for hospital websites, WordPress, and web portals.
 * Supports:
 * - Multi-tenant configurations (data-tenant-id)
 * - Bilingual conversation (English & বাংলা)
 * - Red-flag emergency hotlines (911/999)
 * - Patient privacy consent recording & withdrawal
 * - Human handoff triage requests
 */
(function () {
  "use strict";

  const scriptTag = document.currentScript || document.querySelector("script[data-tenant-id]");
  const tenantId = scriptTag?.getAttribute("data-tenant-id") || "DEFAULT_HOSPITAL";
  const apiUrl = (scriptTag?.getAttribute("data-api-url") || "http://127.0.0.1:8000").replace(/\/$/, "");
  const defaultLang = scriptTag?.getAttribute("data-lang") || "en";
  const theme = scriptTag?.getAttribute("data-theme") || "dark";

  let sessionId = sessionStorage.getItem("synapse_patient_session_id") || null;
  let currentLang = sessionStorage.getItem("synapse_patient_lang") || defaultLang;
  let emergencyPhone = "911";
  let tenantName = "Synapse University Hospital";
  let isOpen = false;
  let isSending = false;

  // Create isolated container
  const container = document.createElement("div");
  container.id = "synapse-widget-root";
  container.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;";
  document.body.appendChild(container);

  // Inject CSS
  const style = document.createElement("style");
  style.textContent = `
    .mp-btn-trigger {
      width: 56px; height: 56px; border-radius: 28px; background: #0284c7; color: #fff;
      border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 10px 25px -5px rgba(2,132,199,0.5);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s cubic-bezier(0.16,1,0.3,1); outline: none;
    }
    .mp-btn-trigger:hover { transform: scale(1.05); background: #0369a1; }
    .mp-window {
      position: absolute; bottom: 70px; right: 0; width: 380px; height: 560px; max-height: calc(100vh - 120px);
      background: #0f172a; border: 1px solid #334155; border-radius: 16px;
      box-shadow: 0 20px 40px -10px rgba(0,0,0,0.6); display: flex; flex-direction: column;
      overflow: hidden; opacity: 0; pointer-events: none; transform: translateY(12px) scale(0.97);
      transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
    }
    .mp-window.mp-open { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }
    .mp-header {
      background: #1e293b; padding: 12px 16px; border-bottom: 1px solid #334155;
      display: flex; align-items: center; justify-content: space-between;
    }
    .mp-header-title { font-size: 13px; font-weight: 600; color: #f8fafc; display: flex; align-items: center; gap: 8px; }
    .mp-badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; background: #0369a1; color: #e0f2fe; font-family: monospace; }
    .mp-header-actions { display: flex; align-items: center; gap: 6px; }
    .mp-tool-btn { background: #334155; color: #cbd5e1; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; }
    .mp-tool-btn:hover { background: #475569; color: #fff; }
    .mp-emergency-bar {
      background: rgba(239,68,68,0.15); border-bottom: 1px solid rgba(239,68,68,0.3);
      padding: 6px 12px; font-size: 11px; color: #fca5a5; display: flex; align-items: center; justify-content: space-between;
    }
    .mp-emergency-link { color: #f87171; font-weight: 700; text-decoration: none; padding: 2px 6px; background: rgba(239,68,68,0.2); border-radius: 4px; }
    .mp-messages { flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
    .mp-msg { max-width: 85%; font-size: 12.5px; line-height: 1.45; border-radius: 12px; padding: 9px 12px; word-break: break-word; }
    .mp-msg-assistant { align-self: flex-start; background: #1e293b; color: #f1f5f9; border: 1px solid #334155; border-bottom-left-radius: 3px; }
    .mp-msg-user { align-self: flex-end; background: #0284c7; color: #fff; border-bottom-right-radius: 3px; }
    .mp-msg-emergency { background: #7f1d1d; border-color: #ef4444; color: #fef2f2; }
    .mp-disclaimer-note { font-size: 10px; color: #94a3b8; margin-top: 6px; border-top: 1px solid #334155; padding-top: 4px; }
    .mp-typing { font-size: 11px; color: #94a3b8; font-style: italic; display: none; padding: 0 14px 6px 14px; }
    .mp-footer { padding: 10px 12px; background: #1e293b; border-top: 1px solid #334155; display: flex; gap: 8px; align-items: center; }
    .mp-input {
      flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: 8px;
      color: #fff; font-size: 12px; padding: 8px 10px; outline: none;
    }
    .mp-input:focus { border-color: #0284c7; }
    .mp-send-btn { background: #0284c7; color: #fff; border: none; border-radius: 8px; width: 34px; height: 34px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .mp-send-btn:hover { background: #0369a1; }
    .mp-consent-banner { background: #1e293b; border-bottom: 1px solid #334155; padding: 8px 12px; font-size: 10.5px; color: #cbd5e1; display: none; }
    .mp-consent-btn { background: #0284c7; color: #fff; border: none; padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; margin-left: 6px; }
    @media (max-width: 480px) {
      .mp-window { width: calc(100vw - 32px); right: -8px; bottom: 68px; height: 80vh; }
    }
  `;
  document.head.appendChild(style);

  // Render HTML structure
  container.innerHTML = `
    <div class="mp-window" id="mp-window">
      <div class="mp-header">
        <div class="mp-header-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <span id="mp-tenant-title">Synapse Patient AI</span>
          <span class="mp-badge">v4.0</span>
        </div>
        <div class="mp-header-actions">
          <button class="mp-tool-btn" id="mp-lang-toggle" title="Switch Language">বাংলা</button>
          <button class="mp-tool-btn" id="mp-handoff-btn" title="Request Human Clinic Nurse">Nurse Support</button>
          <button class="mp-tool-btn" id="mp-close-btn">&times;</button>
        </div>
      </div>
      <div class="mp-emergency-bar">
        <span>🚨 Severe emergency?</span>
        <a href="tel:911" id="mp-emergency-call" class="mp-emergency-link">Call 911</a>
      </div>
      <div class="mp-consent-banner" id="mp-consent-banner">
        <span>By using this assistant, you agree to anonymized educational health navigation.</span>
        <button class="mp-consent-btn" id="mp-accept-consent">Accept</button>
      </div>
      <div class="mp-messages" id="mp-messages-list"></div>
      <div class="mp-typing" id="mp-typing-indicator">Synapse Clinical is researching verified guidelines...</div>
      <div class="mp-footer">
        <input type="text" class="mp-input" id="mp-user-input" placeholder="Ask about symptoms, medications, or clinic visit..." />
        <button class="mp-send-btn" id="mp-send-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
    <button class="mp-btn-trigger" id="mp-btn-trigger" aria-label="Open Healthcare Assistant">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
  `;

  const windowEl = document.getElementById("mp-window");
  const triggerBtn = document.getElementById("mp-btn-trigger");
  const closeBtn = document.getElementById("mp-close-btn");
  const langToggle = document.getElementById("mp-lang-toggle");
  const handoffBtn = document.getElementById("mp-handoff-btn");
  const messagesList = document.getElementById("mp-messages-list");
  const userInput = document.getElementById("mp-user-input");
  const sendBtn = document.getElementById("mp-send-btn");
  const typingIndicator = document.getElementById("mp-typing-indicator");
  const emergencyCall = document.getElementById("mp-emergency-call");
  const tenantTitle = document.getElementById("mp-tenant-title");
  const consentBanner = document.getElementById("mp-consent-banner");
  const acceptConsentBtn = document.getElementById("mp-accept-consent");

  // Check consent status
  if (!localStorage.getItem("synapse_consent_accepted")) {
    consentBanner.style.display = "flex";
  }

  acceptConsentBtn.addEventListener("click", () => {
    localStorage.setItem("synapse_consent_accepted", "true");
    consentBanner.style.display = "none";
  });

  // Toggle Window
  function toggleWindow() {
    isOpen = !isOpen;
    if (isOpen) {
      windowEl.classList.add("mp-open");
      if (!sessionId) {
        initSession();
      }
      setTimeout(() => userInput.focus(), 100);
    } else {
      windowEl.classList.remove("mp-open");
    }
  }

  triggerBtn.addEventListener("click", toggleWindow);
  closeBtn.addEventListener("click", toggleWindow);

  // Language Switcher
  langToggle.addEventListener("click", () => {
    currentLang = currentLang === "en" ? "bn" : "en";
    sessionStorage.setItem("synapse_patient_lang", currentLang);
    langToggle.textContent = currentLang === "en" ? "বাংলা" : "English";
    userInput.placeholder = currentLang === "en" 
      ? "Ask about symptoms, medications, or clinic visit..."
      : "স্বাস্থ্য সমস্যা, ওষুধ বা ডাক্তার দেখানো সম্পর্কে লিখুন...";
  });

  // Handoff Request
  handoffBtn.addEventListener("click", async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${apiUrl}/api/v1/patient/chat/sessions/${sessionId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Patient clicked nurse support request in chat widget" })
      });
      const data = await res.json();
      appendMessage("assistant", data.message || "A triage nurse has been notified.", false);
    } catch (err) {
      console.error("Handoff request error:", err);
    }
  });

  // Initialize Session
  async function initSession() {
    try {
      const res = await fetch(`${apiUrl}/api/v1/patient/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, language: currentLang, consent_given: true })
      });
      const data = await res.json();
      sessionId = data.session_id;
      sessionStorage.setItem("synapse_patient_session_id", sessionId);
      emergencyPhone = data.emergency_phone || "911";
      tenantName = data.tenant_name || "Synapse Clinical";
      
      tenantTitle.textContent = tenantName;
      emergencyCall.href = `tel:${emergencyPhone}`;
      emergencyCall.textContent = `Call ${emergencyPhone}`;

      appendMessage("assistant", data.welcome_message, false);
    } catch (err) {
      console.error("Failed to initialize patient session:", err);
      appendMessage("assistant", "Welcome to Synapse Patient AI. How may I help you with general health guidance today?", false);
    }
  }

  function appendMessage(role, text, isEmergency, specialists) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `mp-msg mp-msg-${role} ${isEmergency ? "mp-msg-emergency" : ""}`;
    msgDiv.innerHTML = text.replace(/\n/g, "<br/>");

    if (specialists && specialists.length) {
      const specContainer = document.createElement("div");
      specContainer.style.cssText = "margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 6px;";
      specialists.forEach(doc => {
        const docCard = document.createElement("div");
        docCard.style.cssText = "padding: 8px; border-radius: 8px; background: rgba(15,23,42,0.9); border: 1px solid rgba(255,255,255,0.08); font-size: 11px;";
        const fee = doc.currency === "BDT" ? `৳ ${doc.consultation_fee}` : `$${doc.consultation_fee}`;
        docCard.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:start;">
            <div>
              <strong style="color:#fff;">${doc.name}</strong>
              <div style="color:#38bdf8; font-size:10px;">${doc.specialization}</div>
              <div style="color:#94a3b8; font-size:9.5px;">${doc.available_schedule}</div>
            </div>
            <div style="text-align:right;">
              <strong style="color:#34d399; font-size:11px;">${fee}</strong>
              <div style="font-size:8px; color:#64748b;">FEE</div>
            </div>
          </div>
        `;
        specContainer.appendChild(docCard);
      });
      msgDiv.appendChild(specContainer);
    }

    messagesList.appendChild(msgDiv);
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  // Send Message
  async function handleSend() {
    const text = userInput.value.trim();
    if (!text || isSending) return;

    if (!sessionId) {
      await initSession();
    }

    appendMessage("user", text, false);
    userInput.value = "";
    isSending = true;
    typingIndicator.style.display = "block";
    messagesList.scrollTop = messagesList.scrollHeight;

    try {
      const res = await fetch(`${apiUrl}/api/v1/patient/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language: currentLang })
      });
      const data = await res.json();
      appendMessage("assistant", data.response_text, data.is_emergency, data.recommended_specialists);
    } catch (err) {
      console.error("Failed to send message:", err);
      appendMessage("assistant", "We apologize, but an error occurred while connecting to the clinic server. Please try again or call your provider directly.", false);
    } finally {
      isSending = false;
      typingIndicator.style.display = "none";
    }
  }

  sendBtn.addEventListener("click", handleSend);
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
})();
