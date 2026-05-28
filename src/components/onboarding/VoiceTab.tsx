"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PathwaysOrb, WaveformBars } from "@/components/voice/PathwaysOrb";
import "@/components/voice/VoiceTab.css";
import type { OrbState } from "@/components/voice/PathwaysOrb";
import type { Message, VoiceExtractedProfile } from "@/modules/voice/types";
import { createRequestLogger } from "@/lib/logger";

const log = createRequestLogger("voice-tab");

const STATUS_TEXT: Record<OrbState, string> = {
  idle: "Ready when you are.",
  listening: "Listening…",
  thinking: "Processing…",
  speaking: "Speaking…",
};

const STATE_ARIA: Record<OrbState, string> = {
  idle: "Start voice session",
  listening: "Listening — tap to stop",
  thinking: "Processing your response",
  speaking: "Speaking — tap to stop",
};

interface VoiceTabProps {
  onProfileUpdate: (delta: Partial<VoiceExtractedProfile>) => void;
  onSwitchToChat: () => void;
  requiredCollected: number;
  totalRequired: number;
}

/** Convert Float32 PCM samples (-1..1) to a signed 16-bit little-endian ArrayBuffer. */
function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** Voice onboarding orb column — Gladia STT, Claude SSE stream, ElevenLabs TTS. */
export function VoiceTab({
  onProfileUpdate,
  onSwitchToChat,
  requiredCollected,
  totalRequired,
}: VoiceTabProps) {
  const router = useRouter();
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Overrides STATUS_TEXT during the post-completion transition
  const [statusOverride, setStatusOverride] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartMsRef = useRef<number>(0);
  const historyRef = useRef<Message[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gladiaWsRef = useRef<WebSocket | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const currentTranscriptRef = useRef<string>("");
  const animFrameRef = useRef<number | null>(null);
  const isProcessingTurnRef = useRef(false);
  const pendingSpeechEndRef = useRef<boolean>(false);
  const isStartingRef = useRef(false);
  const turnAbortRef = useRef<AbortController | null>(null);
  const speechEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the currently-playing audio element so it can be paused atomically on abort
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const cleanup = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (gladiaWsRef.current?.readyState === WebSocket.OPEN) {
      gladiaWsRef.current.close();
    }
    gladiaWsRef.current = null;
    pendingSpeechEndRef.current = false;
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (turnAbortRef.current) {
      turnAbortRef.current.abort();
      turnAbortRef.current = null;
    }
    if (speechEndTimerRef.current !== null) {
      clearTimeout(speechEndTimerRef.current);
      speechEndTimerRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  /** Play a base64 audio blob. The abort signal pauses the element immediately on abort. */
  const playAudio = useCallback(
    async (base64Audio: string, signal?: AbortSignal): Promise<void> => {
      return new Promise((resolve) => {
        if (signal?.aborted) { resolve(); return; }
        const audioBytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
        const blob = new Blob([audioBytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;
        const done = () => {
          URL.revokeObjectURL(url);
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          resolve();
        };
        audio.onended = done;
        audio.onerror = done;
        if (signal) {
          signal.addEventListener("abort", () => { audio.pause(); done(); }, { once: true });
        }
        audio.play().catch(done);
      });
    },
    []
  );

  const sendTurn = useCallback(
    async (transcript: string) => {
      if (!sessionIdRef.current) return;

      if (turnAbortRef.current) turnAbortRef.current.abort();
      const ac = new AbortController();
      turnAbortRef.current = ac;
      const { signal } = ac;

      isProcessingTurnRef.current = true;
      pendingSpeechEndRef.current = false;
      setOrbState("thinking");

      try {
        const res = await fetch("/api/voice/turn", {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            "x-session-start": String(sessionStartMsRef.current),
          },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            transcript: transcript.trim(),
            history: historyRef.current,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Turn request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        let complete = false;
        let agentMessage = "";
        const audioQueue: string[] = [];
        let isPlaying = false;

        const drainQueue = async () => {
          if (isPlaying) return;
          isPlaying = true;
          while (audioQueue.length > 0) {
            if (signal.aborted) break;
            const chunk = audioQueue.shift();
            if (chunk) {
              setOrbState("speaking");
              await playAudio(chunk, signal);
            }
          }
          isPlaying = false;
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json) continue;
            let event: unknown;
            try { event = JSON.parse(json); } catch { continue; }
            const e = event as {
              type: string;
              audioBase64?: string;
              message?: string;
              complete?: boolean;
              delta?: Partial<VoiceExtractedProfile>;
            };
            if (e.type === "audio" && e.audioBase64) {
              audioQueue.push(e.audioBase64);
              void drainQueue();
            }
            if (e.type === "meta") {
              agentMessage = e.message ?? "";
              complete = e.complete ?? false;
              if (e.delta && Object.keys(e.delta).length > 0) {
                onProfileUpdate(e.delta as Partial<VoiceExtractedProfile>);
              }
            }
            if (e.type === "error") throw new Error(e.message ?? "Stream error");
          }
        }

        while (audioQueue.length > 0 || isPlaying) {
          await new Promise<void>((r) => setTimeout(r, 50));
        }

        if (agentMessage) {
          historyRef.current = [
            ...historyRef.current,
            { role: "user", content: transcript.trim() },
            { role: "assistant", content: agentMessage },
          ];
        }

        if (complete) {
          setOrbState("thinking");
          setStatusOverride("Building your pathway…");
          await new Promise<void>((r) => setTimeout(r, 1500));
          cleanup();
          router.push("/dashboard");
          return;
        }

        isProcessingTurnRef.current = false;
        turnAbortRef.current = null;
        currentTranscriptRef.current = "";
        setOrbState("listening");
      } catch (err) {
        turnAbortRef.current = null;
        if (err instanceof Error && err.name === "AbortError") {
          isProcessingTurnRef.current = false;
          return;
        }
        setError("Something went wrong. Please try again.");
        setOrbState("listening");
        isProcessingTurnRef.current = false;
      }
    },
    [playAudio, router, cleanup, onProfileUpdate]
  );

  const startAmplitudeLoop = useCallback((analyser: AnalyserNode) => {
    const loop = () => { animFrameRef.current = requestAnimationFrame(loop); };
    animFrameRef.current = requestAnimationFrame(loop);
    void analyser;
  }, []);

  const handleGladiaMessage = useCallback(
    (event: MessageEvent) => {
      let msg: unknown;
      try { msg = JSON.parse(event.data as string); } catch { return; }
      const data = msg as {
        type?: string;
        data?: { utterance?: { text?: string }; is_final?: boolean };
      };
      if (
        data.type === "transcript" &&
        data.data?.is_final === true &&
        (data.data?.utterance?.text ?? "").trim().length > 0
      ) {
        const segment = data.data.utterance!.text!.trim();
        currentTranscriptRef.current = (currentTranscriptRef.current + " " + segment).trim();
        if (pendingSpeechEndRef.current && !isProcessingTurnRef.current) {
          pendingSpeechEndRef.current = false;
          const t = currentTranscriptRef.current.trim();
          currentTranscriptRef.current = "";
          if (t.length > 0) void sendTurn(t);
        }
      }
      if (data.type === "speech_end" && !isProcessingTurnRef.current) {
        if (speechEndTimerRef.current !== null) clearTimeout(speechEndTimerRef.current);
        speechEndTimerRef.current = setTimeout(() => {
          speechEndTimerRef.current = null;
          if (isProcessingTurnRef.current) return;
          const t = currentTranscriptRef.current.trim();
          if (t.length > 0) {
            pendingSpeechEndRef.current = false;
            currentTranscriptRef.current = "";
            void sendTurn(t);
          } else {
            pendingSpeechEndRef.current = true;
          }
        }, 300);
      }
    },
    [sendTurn]
  );

  const connectGladia = useCallback(
    async (stream: MediaStream): Promise<void> => {
      const tokenRes = await fetch("/api/voice/gladia-token");
      if (!tokenRes.ok) throw new Error("Failed to create Gladia session");
      const { url } = (await tokenRes.json()) as { url: string };
      const ws = new WebSocket(url);
      gladiaWsRef.current = ws;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("Gladia connection timed out"));
        }, 8000);
        ws.onopen = () => {
          clearTimeout(timeout);
          const audioCtx = audioContextRef.current;
          if (!audioCtx) { ws.close(); reject(new Error("AudioContext not initialised")); return; }
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const processor = audioCtx.createScriptProcessor(2048, 1, 1);
          source.connect(processor);
          processor.connect(audioCtx.destination);
          scriptProcessorRef.current = processor;
          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN && !isProcessingTurnRef.current) {
              ws.send(floatTo16BitPCM(e.inputBuffer.getChannelData(0)));
            }
          };
          startAmplitudeLoop(analyser);
          resolve();
        };
        ws.onmessage = (e: MessageEvent) => handleGladiaMessage(e);
        ws.onerror = () => {
          clearTimeout(timeout);
          setError("Transcription connection lost.");
          setOrbState("idle");
          reject(new Error("Gladia WebSocket error"));
        };
        ws.onclose = (e: CloseEvent) => {
          if (!e.wasClean && !isProcessingTurnRef.current) {
            setError("Transcription connection dropped. Please try again.");
            setOrbState("idle");
          }
        };
      });
    },
    [handleGladiaMessage, startAmplitudeLoop]
  );

  const begin = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setError(null);
    let stream: MediaStream | undefined;
    try {
      const sessionRes = await fetch("/api/voice/session", { method: "POST" });
      if (!sessionRes.ok) throw new Error("Failed to create session");
      const sessionData = (await sessionRes.json()) as {
        sessionId: string;
        resumed: boolean;
        history: Message[];
        partialProfile: Partial<VoiceExtractedProfile>;
      };
      sessionIdRef.current = sessionData.sessionId;
      sessionStartMsRef.current = Date.now();

      if (sessionData.resumed && sessionData.history.length > 0) {
        historyRef.current = sessionData.history;
        if (Object.keys(sessionData.partialProfile).length > 0) {
          onProfileUpdate(sessionData.partialProfile);
        }
      }

      setStarted(true);
      setOrbState("speaking");

      if (!sessionData.resumed || historyRef.current.length === 0) {
        const greetRes = await fetch("/api/voice/turn", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-start": String(sessionStartMsRef.current),
          },
          body: JSON.stringify({ sessionId: sessionData.sessionId, transcript: "", history: [] }),
        });
        if (!greetRes.ok || !greetRes.body) throw new Error("Failed to get opening greeting");

        const greetReader = greetRes.body.getReader();
        const greetDecoder = new TextDecoder();
        let greetBuffer = "";
        let greetAudio = "";
        let greetMessage = "";

        while (true) {
          const { done, value } = await greetReader.read();
          if (done) break;
          greetBuffer += greetDecoder.decode(value, { stream: true });
          const lines = greetBuffer.split("\n");
          greetBuffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json) continue;
            let event: unknown;
            try { event = JSON.parse(json); } catch { continue; }
            const e = event as { type: string; audioBase64?: string; message?: string };
            if (e.type === "error") throw new Error(e.message ?? "Greeting stream error");
            if (e.type === "audio" && e.audioBase64) greetAudio = e.audioBase64;
            if (e.type === "meta" && e.message) greetMessage = e.message;
          }
        }

        if (!greetMessage) throw new Error("Greeting stream incomplete");
        historyRef.current = [{ role: "assistant", content: greetMessage }];
        if (greetAudio) await playAudio(greetAudio);
      }

      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      setOrbState("listening");
    } catch (err) {
      isStartingRef.current = false;
      setStarted(false);
      setOrbState("idle");
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone access is required. Please allow it and try again.");
      } else {
        setError("Could not start the voice session. Please try again.");
      }
      return;
    }

    if (!stream) return;

    try {
      await connectGladia(stream);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ action: "voice.begin.connectGladia.error", error: message });
      setError("Could not connect to transcription service. Please try again.");
      setOrbState("idle");
      cleanup();
    }
  }, [connectGladia, playAudio, cleanup, onProfileUpdate]);

  const handleOrbInteract = useCallback(() => {
    if (!started) void begin();
  }, [started, begin]);

  const handleOrbKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleOrbInteract();
      }
    },
    [handleOrbInteract]
  );

  return (
    <div className="flex flex-col items-center" style={{ gap: 24 }}>
      {/* Orb — tappable to start */}
      <div
        role="button"
        aria-label={STATE_ARIA[orbState]}
        tabIndex={0}
        onClick={handleOrbInteract}
        onKeyDown={handleOrbKeyDown}
        style={{ cursor: started ? "default" : "pointer", outline: "none" }}
      >
        <PathwaysOrb state={orbState} size={220} />
      </div>

      {/* Waveform bars */}
      <WaveformBars active={orbState === "listening" || orbState === "speaking"} />

      {/* State label — remounted on every state change to re-trigger the blur-in animation */}
      <span
        key={statusOverride ?? orbState}
        style={{
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.05em",
          color: "var(--voice-text-muted, #8B8BA0)",
          fontFamily: "Urbanist, sans-serif",
          animation: "voice-label-enter 350ms ease-out both",
        }}
      >
        {statusOverride ?? STATUS_TEXT[orbState]}
      </span>

      {/* Mini progress indicator (visible once session has started) */}
      {started && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 80,
              height: 3,
              background: "rgba(83,74,183,0.15)",
              borderRadius: 2,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${totalRequired > 0 ? Math.round((requiredCollected / totalRequired) * 100) : 0}%`,
                background: "var(--voice-violet, #534AB7)",
                borderRadius: 2,
                transition: "width 500ms ease-out",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 12,
              color: "var(--voice-text-muted, #8B8BA0)",
              fontFamily: "Urbanist, sans-serif",
            }}
          >
            {requiredCollected}/{totalRequired} fields
          </span>
        </div>
      )}

      {/* Begin prompt — shown before the session starts */}
      {!started && (
        <div className="flex flex-col items-center" style={{ gap: 12, maxWidth: 260 }}>
          <p
            className="text-center"
            style={{
              fontSize: 14,
              color: "var(--voice-text-muted, #8B8BA0)",
              fontFamily: "Urbanist, sans-serif",
              lineHeight: 1.5,
            }}
          >
            We'll ask a few questions to understand your situation. Usually 3 minutes.
          </p>
          <button
            onClick={() => void begin()}
            className="btn-primary"
            style={{ padding: "10px 32px" }}
          >
            Begin
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p
          className="text-center text-red-600"
          style={{ fontSize: 13, maxWidth: 260, fontFamily: "Urbanist, sans-serif" }}
        >
          {error}
        </p>
      )}

      {/* Escape hatch to text chat */}
      {started && (
        <button
          onClick={onSwitchToChat}
          style={{
            fontSize: 12,
            color: "var(--voice-text-muted, #8B8BA0)",
            fontFamily: "Urbanist, sans-serif",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Having trouble with your mic? Switch to chat →
        </button>
      )}
    </div>
  );
}
