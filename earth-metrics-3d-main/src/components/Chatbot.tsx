import { useState, useRef, useEffect } from "react";

const API_URL = "http://localhost:8000";

type Message = { role: "user" | "assistant"; content: string };

function formatMessage(text: string) {
  return text.split("\n").filter(Boolean).map((line, i) => (
    <span key={i} className="block">{line}</span>
  ));
}

function RiskBadge({ text }: { text: string }) {
  const riskMatch = text.match(/\b(LOW|MEDIUM|HIGH|CRITICAL)\b/);
  if (!riskMatch) return <>{text}</>;
  const [before, after] = text.split(riskMatch[0]);
  const colors: Record<string, string> = {
    LOW: "#4ade80",
    MEDIUM: "#facc15",
    HIGH: "#f97316",
    CRITICAL: "#ef4444",
  };
  return (
    <>
      {before}
      <span style={{ color: colors[riskMatch[0]], fontWeight: 600 }}>{riskMatch[0]}</span>
      {after}
    </>
  );
}

function AssistantMessage({ content }: { content: string }) {
  const lines = content.split("\n").filter(Boolean);
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => (
        <p key={i} style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "13px", lineHeight: "1.6", color: "#e2e8f0" }}>
          <RiskBadge text={line} />
        </p>
      ))}
    </div>
  );
}

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error contacting advisor. Please try again." }]);
    }
    setLoading(false);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          width: "52px",
          height: "52px",
          borderRadius: "75%",
          background: "#1a2024",
          border: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 0 0 1px #1e293b, 0 8px 32px rgba(0,0,0,0.6)",
          transition: "transform 0.15s ease",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: "88px",
            right: "24px",
            zIndex: 9998,
            width: "420px",
            height: "580px",
            background: "#1a2024",
            border: "1px solid #1e293b",
            borderRadius: "10px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}
        >
          {/* Header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
            <span style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#64748b", textTransform: "uppercase" }}>SoilLink</span>
            <span style={{ marginLeft: "auto", fontSize: "10px", color: "#334155", letterSpacing: "0.1em" }}>ONLINE</span>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {messages.length === 0 && (
              <div style={{ marginTop: "40px", textAlign: "center" }}>
                <p style={{ fontSize: "11px", color: "#334155", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Ask about your soil, crops, or sensor readings
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i}>
                {/* Label */}
                <p style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#475569", textTransform: "uppercase", marginBottom: "6px" }}>
                  {m.role === "user" ? "YOU" : "SOILLINK"}
                </p>

                {m.role === "user" ? (
                  <p style={{ fontSize: "13px", color: "#cbd5e1", fontFamily: "'JetBrains Mono', monospace", lineHeight: "1.6" }}>
                    {m.content}
                  </p>
                ) : (
                  <div style={{
                    background: "#0f1e35",
                    border: "1px solid #1e3a5f",
                    borderRadius: "4px",
                    padding: "14px 16px",
                  }}>
                    <AssistantMessage content={m.content} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div>
                <p style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#475569", textTransform: "uppercase", marginBottom: "6px" }}>SOILLINK</p>
                <div style={{ background: "#0f1e35", border: "1px solid #1e3a5f", borderRadius: "4px", padding: "14px 16px" }}>
                  <span style={{ fontSize: "13px", color: "#475569", fontFamily: "monospace" }}>analyzing</span>
                  <span style={{ animation: "blink 1s step-end infinite", color: "#4ade80" }}>_</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: "1px solid #1e293b", padding: "12px 16px", display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#334155", fontFamily: "monospace" }}>&gt;</span>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="ask soillink..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "13px",
                color: "#e2e8f0",
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                caretColor: "#4ade80",
              }}
            />
            <button
              onClick={send}
              disabled={loading}
              style={{
                background: "transparent",
                border: "1px solid #1e293b",
                borderRadius: "3px",
                padding: "4px 12px",
                fontSize: "11px",
                letterSpacing: "0.1em",
                color: loading ? "#334155" : "#64748b",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "monospace",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = "#4ade80"; e.currentTarget.style.color = "#4ade80"; }}}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.color = "#64748b"; }}
            >
              SEND
            </button>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </>
  );
}