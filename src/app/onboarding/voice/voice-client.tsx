"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Message } from "@/modules/voice/types";

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

const SILENCE_THRESHOLD_MS = 1200;
const SILENCE_AMPLITUDE_THRESHOLD = 0.015;

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

/** Voice conversation client — amplitude-based silence detection, record → transcribe → turn. */
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
  const audioChunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  // Prevents a second transcription from firing while one turn is already in flight
  const isProcessingTurnRef = useRef(false);

  const cleanup = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
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

      setOrbState("thinking");
      audioChunksRef.current = [];

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

        // Restart recording for next turn
        isProcessingTurnRef.current = false;
        audioChunksRef.current = [];
        if (mediaRecorderRef.current?.state === "paused") {
          mediaRecorderRef.current.resume();
        } else if (mediaRecorderRef.current?.state === "inactive") {
          mediaRecorderRef.current.start(100);
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

  const transcribeAndSend = useCallback(async () => {
    if (isProcessingTurnRef.current) return;
    if (!mediaRecorderRef.current) return;

    isProcessingTurnRef.current = true;
    setOrbState("thinking");

    // Stop recorder to finalise the audio file
    mediaRecorderRef.current.stop();

    // Wait for the final ondataavailable to fire
    await new Promise<void>((resolve) => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = () => resolve();
      } else {
        resolve();
      }
    });

    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];

    if (chunks.length === 0) {
      isProcessingTurnRef.current = false;
      setOrbState("listening");
      return;
    }

    try {
      const mimeType = chunks[0]?.type || "audio/webm";
      const audioBlob = new Blob(chunks, { type: mimeType });
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");

      const transcribeRes = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!transcribeRes.ok) {
        throw new Error(`Transcription failed: ${transcribeRes.status}`);
      }

      const { transcript } = (await transcribeRes.json()) as {
        transcript: string;
      };

      if (!transcript.trim()) {
        // No speech detected — restart recording silently
        isProcessingTurnRef.current = false;
        if (mediaRecorderRef.current && sessionIdRef.current) {
          audioChunksRef.current = [];
          mediaRecorderRef.current.start(100);
        }
        setOrbState("listening");
        return;
      }

      await sendTurn(transcript);
    } catch {
      setError("Something went wrong. Please try again.");
      setOrbState("listening");
      isProcessingTurnRef.current = false;
    }
  }, [sendTurn]);

  const startAmplitudeLoop = useCallback(
    (analyser: AnalyserNode) => {
      const dataArray = new Float32Array(analyser.fftSize);
      let silenceStart: number | null = null;

      const loop = () => {
        analyser.getFloatTimeDomainData(dataArray);
        let maxAmp = 0;
        for (const v of dataArray) maxAmp = Math.max(maxAmp, Math.abs(v));

        const isSpeaking = maxAmp > SILENCE_AMPLITUDE_THRESHOLD;

        if (isSpeaking) {
          silenceStart = null;
        } else if (!isProcessingTurnRef.current) {
          if (silenceStart === null) {
            silenceStart = Date.now();
          } else if (Date.now() - silenceStart > SILENCE_THRESHOLD_MS) {
            silenceStart = null;
            if (audioChunksRef.current.length > 0) {
              void transcribeAndSend();
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(loop);
      };

      animFrameRef.current = requestAnimationFrame(loop);
    },
    [transcribeAndSend]
  );

  const startRecording = useCallback(async (stream: MediaStream) => {
    audioChunksRef.current = [];

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    recorder.start(100);
  }, []);

  const begin = useCallback(async () => {
    setError(null);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      setOrbState("listening");

      // 5. Start amplitude loop and recording
      startAmplitudeLoop(analyser);
      await startRecording(stream);
    } catch (err) {
      setStarted(false);
      setOrbState("idle");
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone access is required. Please allow it and try again.");
      } else {
        setError("Could not start the voice session. Please try again.");
      }
    }
  }, [startAmplitudeLoop, startRecording, playAudio]);

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
