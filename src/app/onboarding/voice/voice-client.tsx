"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import SiriOrb from "@/components/smooth-ui/siri-orb";
import type { Message } from "@/modules/voice/types";

type OrbState = "idle" | "listening" | "thinking" | "speaking";

const ORB_CONFIGS: Record<
  OrbState,
  { colors: { bg: string; c1: string; c2: string; c3: string }; animationDuration: number }
> = {
  idle: {
    colors: {
      bg: "oklch(95% 0.02 264.695)",
      c1: "oklch(80% 0.05 240)",
      c2: "oklch(85% 0.04 220)",
      c3: "oklch(82% 0.05 260)",
    },
    animationDuration: 24,
  },
  listening: {
    colors: {
      bg: "oklch(95% 0.02 240)",
      c1: "oklch(72% 0.18 235)",
      c2: "oklch(78% 0.14 210)",
      c3: "oklch(75% 0.16 255)",
    },
    animationDuration: 12,
  },
  thinking: {
    colors: {
      bg: "oklch(95% 0.02 280)",
      c1: "oklch(70% 0.18 290)",
      c2: "oklch(76% 0.15 310)",
      c3: "oklch(74% 0.17 270)",
    },
    animationDuration: 5,
  },
  speaking: {
    colors: {
      bg: "oklch(95% 0.02 320)",
      c1: "oklch(72% 0.18 345)",
      c2: "oklch(78% 0.14 210)",
      c3: "oklch(75% 0.16 280)",
    },
    animationDuration: 9,
  },
};

const STATUS_TEXT: Record<OrbState, string> = {
  idle: "Ready when you are.",
  listening: "Listening…",
  thinking: "Processing your response…",
  speaking: "Speaking…",
};

const SILENCE_THRESHOLD_MS = 1500;
const SILENCE_AMPLITUDE_THRESHOLD = 0.02;

/** Voice conversation client — manages Deepgram WebSocket, orb state, and turn processing. */
export function VoiceClient() {
  const router = useRouter();
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartMsRef = useRef<number>(0);
  const historyRef = useRef<Message[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramWsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTranscriptRef = useRef<string>("");
  const isSpeakingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    if (deepgramWsRef.current?.readyState === WebSocket.OPEN) {
      deepgramWsRef.current.close();
    }
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const playAudio = useCallback(
    async (base64Audio: string): Promise<void> => {
      return new Promise((resolve) => {
        const audioBytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
        const blob = new Blob([audioBytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.play().catch(() => resolve());
      });
    },
    []
  );

  const sendTurn = useCallback(
    async (transcript: string) => {
      if (!sessionIdRef.current || !transcript.trim()) return;

      setOrbState("thinking");
      currentTranscriptRef.current = "";

      try {
        const res = await fetch("/api/voice/turn", {
          method: "POST",
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

        if (!res.ok) {
          throw new Error(`Turn request failed: ${res.status}`);
        }

        const data = (await res.json()) as {
          message: string;
          complete: boolean;
          audioBase64: string;
        };

        historyRef.current = [
          ...historyRef.current,
          { role: "user", content: transcript.trim() },
          { role: "assistant", content: data.message },
        ];

        setOrbState("speaking");
        await playAudio(data.audioBase64);

        if (data.complete) {
          cleanup();
          router.push("/onboarding/review");
          return;
        }

        setOrbState("listening");
      } catch {
        setError("Something went wrong. Please try again.");
        setOrbState("listening");
      }
    },
    [playAudio, router, cleanup]
  );

  const startAmplitudeLoop = useCallback((analyser: AnalyserNode) => {
    const dataArray = new Float32Array(analyser.fftSize);

    const loop = () => {
      analyser.getFloatTimeDomainData(dataArray);
      let maxAmp = 0;
      for (const v of dataArray) {
        maxAmp = Math.max(maxAmp, Math.abs(v));
      }

      if (isSpeakingRef.current) {
        if (maxAmp < SILENCE_AMPLITUDE_THRESHOLD) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              const t = currentTranscriptRef.current;
              if (t.trim()) {
                sendTurn(t);
              }
            }, SILENCE_THRESHOLD_MS);
          }
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [sendTurn]);

  const connectDeepgram = useCallback(
    async (stream: MediaStream) => {
      const tokenRes = await fetch("/api/voice/deepgram-token");
      if (!tokenRes.ok) throw new Error("Failed to get Deepgram token");
      const { token } = (await tokenRes.json()) as { token: string };

      const wsUrl =
        `wss://api.deepgram.com/v1/listen` +
        `?model=nova-3` +
        `&utterance_end_ms=${SILENCE_THRESHOLD_MS}` +
        `&interim_results=true` +
        `&access_token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(wsUrl);
      deepgramWsRef.current = ws;

      ws.onopen = () => {
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (ws.readyState === WebSocket.OPEN && e.data.size > 0) {
            ws.send(e.data);
          }
        };

        recorder.start(250);
      };

      ws.onmessage = (event: MessageEvent) => {
        let msg: unknown;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }

        const data = msg as {
          type?: string;
          channel?: { alternatives?: { transcript?: string }[] };
          is_final?: boolean;
        };

        if (data.type === "Results" && data.is_final) {
          const t = data.channel?.alternatives?.[0]?.transcript ?? "";
          if (t) {
            currentTranscriptRef.current += (currentTranscriptRef.current ? " " : "") + t;
            isSpeakingRef.current = true;
          }
        }

        if (data.type === "UtteranceEnd") {
          if (currentTranscriptRef.current.trim()) {
            sendTurn(currentTranscriptRef.current);
          }
        }
      };

      ws.onerror = () => {
        setError("Transcription connection failed. Please try again.");
      };
    },
    [sendTurn]
  );

  const begin = useCallback(async () => {
    setError(null);

    try {
      // Create session
      const sessionRes = await fetch("/api/voice/session", { method: "POST" });
      if (!sessionRes.ok) throw new Error("Failed to create session");
      const { sessionId } = (await sessionRes.json()) as { sessionId: string };
      sessionIdRef.current = sessionId;
      sessionStartMsRef.current = Date.now();

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      // Set up Web Audio API for amplitude analysis
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setStarted(true);
      setOrbState("listening");

      startAmplitudeLoop(analyser);
      await connectDeepgram(stream);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone access is required. Please allow it and try again.");
      } else {
        setError("Could not start the voice session. Please try again.");
      }
    }
  }, [connectDeepgram, startAmplitudeLoop]);

  const orbConfig = ORB_CONFIGS[orbState];

  return (
    <div className="flex flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-neutral-600 tracking-wide">
          {started ? null : "We will ask you a few questions to understand your situation."}
        </p>
        <p className="text-xs text-neutral-400">
          {started ? null : "This usually takes about 3 minutes."}
        </p>
      </div>

      <SiriOrb
        size="280px"
        colors={orbConfig.colors}
        animationDuration={orbConfig.animationDuration}
      />

      <p className="text-sm text-neutral-600">{STATUS_TEXT[orbState]}</p>

      {!started && (
        <button
          onClick={begin}
          className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Begin
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600 max-w-xs text-center">{error}</p>
      )}
    </div>
  );
}
