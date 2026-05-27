"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import type { Message, VoiceExtractedProfile } from "@/modules/voice/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatTabProps {
  onProfileUpdate: (delta: Partial<VoiceExtractedProfile>) => void;
}

/** Chat tab — text-based conversation using the same /api/voice/turn backend as VoiceTab. */
export function ChatTab({ onProfileUpdate }: ChatTabProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const sessionStartMsRef = useRef<number>(0);
  const historyRef = useRef<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize session and show opening greeting on mount
  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      try {
        const sessionRes = await fetch("/api/voice/session", { method: "POST" });
        if (!sessionRes.ok || cancelled) return;
        const sessionData = (await sessionRes.json()) as {
          sessionId: string;
          resumed: boolean;
          history: Message[];
          partialProfile: Partial<VoiceExtractedProfile>;
        };
        if (cancelled) return;

        const sid = sessionData.sessionId;
        setSessionId(sid);
        sessionStartMsRef.current = Date.now();

        // Seed accumulated data from resumed session
        if (sessionData.resumed && sessionData.history.length > 0) {
          historyRef.current = sessionData.history;
          if (Object.keys(sessionData.partialProfile).length > 0) {
            onProfileUpdate(sessionData.partialProfile);
          }
          // Show existing history as messages
          const chatHistory: ChatMessage[] = sessionData.history.map((m) => ({
            role: m.role,
            content: m.content,
          }));
          setMessages(chatHistory);
          setSessionReady(true);
          return;
        }

        // Fresh session — fetch opening greeting (text only, ignore audio)
        const greetRes = await fetch("/api/voice/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-session-start": String(sessionStartMsRef.current) },
          body: JSON.stringify({ sessionId: sid, transcript: "", history: [] }),
        });
        if (!greetRes.ok || !greetRes.body || cancelled) return;

        const reader = greetRes.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let greetMessage = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json) continue;
            let event: unknown;
            try { event = JSON.parse(json); } catch { continue; }
            const e = event as { type: string; message?: string };
            if (e.type === "meta" && e.message) greetMessage = e.message;
          }
        }

        if (!cancelled && greetMessage) {
          historyRef.current = [{ role: "assistant", content: greetMessage }];
          setMessages([{ role: "assistant", content: greetMessage }]);
        }
        if (!cancelled) setSessionReady(true);
      } catch {
        if (!cancelled) setSessionReady(true);
      }
    };

    void initSession();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !sessionId || isLoading) return;

    setInput("");
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await fetch("/api/voice/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-start": String(sessionStartMsRef.current) },
        body: JSON.stringify({ sessionId, transcript: text, history: historyRef.current }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let agentMessage = "";
      let complete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          let event: unknown;
          try { event = JSON.parse(json); } catch { continue; }
          const e = event as { type: string; message?: string; complete?: boolean; delta?: Partial<VoiceExtractedProfile> };
          if (e.type === "meta") {
            agentMessage = e.message ?? "";
            complete = e.complete ?? false;
            if (e.delta && Object.keys(e.delta).length > 0) {
              onProfileUpdate(e.delta as Partial<VoiceExtractedProfile>);
            }
          }
        }
      }

      if (agentMessage) {
        historyRef.current = [
          ...historyRef.current,
          { role: "user", content: text },
          { role: "assistant", content: agentMessage },
        ];
        setMessages((prev) => [...prev, { role: "assistant", content: agentMessage }]);
      }

      if (complete) {
        router.push("/onboarding/review");
        return;
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, sessionId, isLoading, router, onProfileUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  if (!sessionReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-accent-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={[
                "max-w-[85%] rounded-card px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-accent-500 text-white"
                  : "bg-bg-subtle text-text-primary",
              ].join(" ")}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-bg-subtle rounded-card px-4 py-3 flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-border-light shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Type your response…"
            disabled={isLoading}
            className="flex-1 resize-none border border-border rounded-input px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 shrink-0 flex items-center justify-center bg-accent-500 text-white rounded-input hover:bg-accent-600 disabled:opacity-40 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
