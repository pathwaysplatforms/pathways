"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Message } from "@/modules/voice/types";
import { createRequestLogger } from "@/lib/logger";

const log = createRequestLogger("voice-client");

// SSR disabled — the orb injects a <style> tag that causes a hydration mismatch when server-rendered
const SiriOrb = dynamic(() => import("@/components/smooth-ui/siri-orb"), { ssr: false });

type OrbState = "idle" | "listening" | "thinking" | "speaking";

// Pathways brand palette — sourced from PathwaysOrb.tsx in the reference implementation
const BRAND_ORB_COLORS = {
  bg: "#0F0D1E", // deep dark navy — orb interior base
  c1: "#534AB7", // primary violet
  c2: "#1D9E75", // accent teal
  c3: "#8B7CF8", // lighter purple
};

// Animation durations per state — sourced from ORB_ANIMATION_DURATION in PathwaysOrb.tsx
const ORB_CONFIGS: Record<OrbState, { colors: typeof BRAND_ORB_COLORS; animationDuration: number }> = {
  idle:      { colors: BRAND_ORB_COLORS, animationDuration: 18 },
  listening: { colors: BRAND_ORB_COLORS, animationDuration: 6 },
  thinking:  { colors: BRAND_ORB_COLORS, animationDuration: 12 },
  speaking:  { colors: BRAND_ORB_COLORS, animationDuration: 8 },
};

const STATUS_TEXT: Record<OrbState, string> = {
  idle: "Ready when you are.",
  listening: "Listening…",
  thinking: "Processing your response…",
  speaking: "Speaking…",
};

function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

/** Voice conversation client — Deepgram live WebSocket STT, Claude SSE stream, ElevenLabs TTS. */
export function VoiceClient() {
  const router = useRouter();
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartMsRef = useRef<number>(0);
  const historyRef = useRef<Message[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const deepgramWsRef = useRef<WebSocket | null>(null);
  const currentTranscriptRef = useRef<string>("");
  const animFrameRef = useRef<number | null>(null);
  const isProcessingTurnRef = useRef(false);

  const cleanup = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (deepgramWsRef.current?.readyState === WebSocket.OPEN) {
      deepgramWsRef.current.close();
    }
    deepgramWsRef.current = null;
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
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
      if (!sessionIdRef.current) return;

      isProcessingTurnRef.current = true;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.pause();
      }
      setOrbState("thinking");

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

        if (!res.ok || !res.body) {
          throw new Error(`Turn request failed: ${res.status}`);
        }

        // Consume the SSE stream, playing audio chunks as they arrive
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        let complete = false;
        let agentMessage = "";

        // Sequential playback queue — drains automatically as chunks arrive
        const audioQueue: string[] = [];
        let isPlaying = false;

        const drainQueue = async () => {
          if (isPlaying) return;
          isPlaying = true;
          while (audioQueue.length > 0) {
            const chunk = audioQueue.shift();
            if (chunk) {
              setOrbState("speaking");
              await playAudio(chunk);
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
            try {
              event = JSON.parse(json);
            } catch {
              continue;
            }

            const e = event as {
              type: string;
              audioBase64?: string;
              message?: string;
              complete?: boolean;
            };

            if (e.type === "audio" && e.audioBase64) {
              audioQueue.push(e.audioBase64);
              void drainQueue();
            }

            if (e.type === "meta") {
              agentMessage = e.message ?? "";
              complete = e.complete ?? false;
            }

            if (e.type === "error") {
              throw new Error(e.message ?? "Stream error");
            }
          }
        }

        // Wait for all queued audio to finish playing
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
          cleanup();
          router.push("/onboarding/review");
          return;
        }

        // Resume recording for next turn
        isProcessingTurnRef.current = false;
        currentTranscriptRef.current = "";
        if (mediaRecorderRef.current?.state === "paused") {
          mediaRecorderRef.current.resume();
        }
        setOrbState("listening");
      } catch {
        setError("Something went wrong. Please try again.");
        setOrbState("listening");
        isProcessingTurnRef.current = false;
        if (mediaRecorderRef.current?.state === "paused") {
          mediaRecorderRef.current.resume();
        }
      }
    },
    [playAudio, router, cleanup]
  );

  const startAmplitudeLoop = useCallback(
    (analyser: AnalyserNode) => {
      const dataArray = new Float32Array(analyser.fftSize);
      const loop = () => {
        analyser.getFloatTimeDomainData(dataArray);
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    },
    []
  );

  /**
   * Open a live Deepgram WebSocket directly from the browser.
   * Authentication via a short-lived key fetched from our API.
   * The browser streams audio chunks; Deepgram fires UtteranceEnd
   * when the user stops speaking (~100ms latency vs ~400ms HTTP).
   */
  const connectDeepgram = useCallback(
    async (stream: MediaStream) => {
      const tokenRes = await fetch("/api/voice/deepgram-token");
      if (!tokenRes.ok) throw new Error("Failed to get Deepgram token");
      const { token } = (await tokenRes.json()) as { token: string };

      const dgUrl =
        "wss://api.deepgram.com/v1/listen" +
        "?model=nova-3" +
        "&language=en" +
        "&smart_format=true" +
        "&interim_results=true" +
        "&utterance_end_ms=1000" +
        "&vad_events=true" +
        `&access_token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(dgUrl);
      deepgramWsRef.current = ws;

      // Wait for connection to open before returning — 8s timeout guards against key expiry race
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("Deepgram connection timed out"));
        }, 8000);

        ws.onopen = () => {
          clearTimeout(timeout);

          const mimeType = getSupportedMimeType();
          const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

          recorder.ondataavailable = (e) => {
            if (ws.readyState === WebSocket.OPEN && e.data.size > 0) {
              ws.send(e.data);
            }
          };

          recorder.start(100);
          mediaRecorderRef.current = recorder;

          resolve();
        };
      });

      ws.onmessage = (event: MessageEvent) => {
        let msg: unknown;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }

        const data = msg as {
          type?: string;
          channel?: {
            alternatives?: { transcript?: string }[];
          };
          is_final?: boolean;
          speech_final?: boolean;
        };

        // Accumulate final transcript segments
        if (
          data.type === "Results" &&
          data.is_final &&
          data.channel?.alternatives?.[0]?.transcript
        ) {
          const segment = data.channel.alternatives[0].transcript;
          currentTranscriptRef.current +=
            (currentTranscriptRef.current ? " " : "") + segment;
        }

        const utteranceEnd = data.type === "UtteranceEnd";
        const speechFinal = data.type === "Results" && data.speech_final === true;

        if ((utteranceEnd || speechFinal) && !isProcessingTurnRef.current) {
          const transcript = currentTranscriptRef.current.trim();
          currentTranscriptRef.current = "";
          if (transcript) {
            void sendTurn(transcript);
          }
        }
      };

      ws.onerror = () => {
        setError("Transcription connection lost. Please try again.");
        setOrbState("idle");
      };

      ws.onclose = (event: CloseEvent) => {
        if (!event.wasClean && !isProcessingTurnRef.current) {
          setError("Transcription connection dropped. Please try again.");
          setOrbState("idle");
        }
      };
    },
    [sendTurn]
  );

  const begin = useCallback(async () => {
    setError(null);

    let stream: MediaStream | undefined;
    let analyser: AnalyserNode | undefined;

    try {
      // 1. Create session
      const sessionRes = await fetch("/api/voice/session", { method: "POST" });
      if (!sessionRes.ok) throw new Error("Failed to create session");
      const { sessionId } = (await sessionRes.json()) as { sessionId: string };
      sessionIdRef.current = sessionId;
      sessionStartMsRef.current = Date.now();
      setStarted(true);

      // 2. Fetch opening greeting before mic is activated
      setOrbState("speaking");
      const greetRes = await fetch("/api/voice/turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-start": String(sessionStartMsRef.current),
        },
        body: JSON.stringify({ sessionId, transcript: "", history: [] }),
      });
      if (!greetRes.ok || !greetRes.body) {
        throw new Error("Failed to get opening greeting");
      }

      // Read the SSE stream — same pattern as sendTurn()
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

          if (e.type === "audio" && e.audioBase64) {
            greetAudio = e.audioBase64;
          }
          if (e.type === "meta" && e.message) {
            greetMessage = e.message;
          }
        }
      }

      if (!greetAudio || !greetMessage) {
        throw new Error("Greeting stream did not return audio or message");
      }

      historyRef.current = [{ role: "assistant", content: greetMessage }];

      // 3. Play greeting — mic stays off until audio finishes
      await playAudio(greetAudio);

      // 4. Activate microphone
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      setOrbState("listening");
    } catch (err) {
      setStarted(false);
      setOrbState("idle");
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone access is required. Please allow it and try again.");
      } else {
        setError("Could not start the voice session. Please try again.");
      }
      return;
    }

    // Guard satisfies TypeScript — both are always assigned if the try block above completed
    if (!stream || !analyser) return;

    // 5. Start amplitude loop and connect to Deepgram — isolated so a WebSocket
    //    rejection does not show the generic "could not start" error
    startAmplitudeLoop(analyser);
    try {
      await connectDeepgram(stream);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ action: "voice.begin.connectDeepgram.error", error: message });
      setError("Could not connect to transcription service. Please try again.");
      setOrbState("idle");
      cleanup();
    }
  }, [startAmplitudeLoop, connectDeepgram, playAudio, cleanup]);

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
        size="220px"
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
