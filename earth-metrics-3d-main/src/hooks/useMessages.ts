import { useEffect, useRef, useState } from "react";
import { supabase, type Message } from "../lib/supabase";

const INITIAL_LIMIT = 50;

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track seen ids to deduplicate realtime events (idempotency).
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    // 1. Initial fetch — newest first, then reverse so the feed is oldest-at-top.
    async function fetchInitial() {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(INITIAL_LIMIT);

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const rows = (data as Message[]).reverse();
      rows.forEach((r) => seenIds.current.add(r.id));
      setMessages(rows);
      setLoading(false);
    }

    fetchInitial();

    // 2. Realtime subscription — INSERT only, no polling.
    const channel = supabase
      .channel("public:messages", {
        config: { broadcast: { ack: true } },
      })
      .on<Message>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new;
          if (!row?.id || seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          setMessages((prev) => [...prev, row]);
        }
      )
      .subscribe((status, err) => {
        if (err) setError(`Realtime: ${err.message}`);
        // On reconnect, re-fetch to fill any gaps from the offline window.
        if (status === "SUBSCRIBED") fetchInitial();
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { messages, loading, error };
}
