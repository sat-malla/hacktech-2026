import { useEffect, useRef, useState } from "react";
import { useMessages } from "../hooks/useMessages";

const API_URL = "http://localhost:8081";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function MessagesFeed() {
  const { messages, loading, error } = useMessages();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSendError(null);
    setSending(true);
    setInput("");
    try {
      const res = await fetch(`${API_URL}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "send failed");
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0d1117",
        border: "1px solid #1e293b",
        borderRadius: "8px",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 18px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: error ? "#ef4444" : "#4ade80",
            boxShadow: error ? "0 0 6px #ef4444" : "0 0 6px #4ade80",
          }}
        />
        <span
          style={{
            fontSize: "10px",
            letterSpacing: "0.15em",
            color: "#64748b",
            textTransform: "uppercase",
          }}
        >
          Messages — live
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "10px",
            color: "#334155",
            letterSpacing: "0.1em",
          }}
        >
          {messages.length} rows
        </span>
      </div>

      {/* Feed */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {loading && (
          <p style={{ fontSize: "12px", color: "#334155" }}>loading…</p>
        )}
        {error && (
          <p style={{ fontSize: "12px", color: "#ef4444" }}>Error: {error}</p>
        )}
        {!loading && messages.length === 0 && (
          <p style={{ fontSize: "12px", color: "#334155", marginTop: "24px", textAlign: "center" }}>
            no messages yet
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              background: "#111827",
              border: "1px solid #1e293b",
              borderRadius: "4px",
              padding: "10px 14px",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                color: "#475569",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              {formatTime(m.created_at)}
            </p>
            <p style={{ fontSize: "13px", color: "#e2e8f0", lineHeight: 1.55 }}>
              {m.content}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          borderTop: "1px solid #1e293b",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {sendError && (
          <p style={{ fontSize: "11px", color: "#ef4444" }}>{sendError}</p>
        )}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "#334155", fontFamily: "monospace" }}>
            &gt;
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="type a message…"
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
            disabled={sending || !input.trim()}
            style={{
              background: "transparent",
              border: "1px solid #1e293b",
              borderRadius: "3px",
              padding: "4px 12px",
              fontSize: "11px",
              letterSpacing: "0.1em",
              color: sending ? "#334155" : "#64748b",
              cursor: sending ? "not-allowed" : "pointer",
              fontFamily: "monospace",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!sending) {
                e.currentTarget.style.borderColor = "#4ade80";
                e.currentTarget.style.color = "#4ade80";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#1e293b";
              e.currentTarget.style.color = "#64748b";
            }}
          >
            {sending ? "…" : "SEND"}
          </button>
        </div>
      </div>
    </div>
  );
}
