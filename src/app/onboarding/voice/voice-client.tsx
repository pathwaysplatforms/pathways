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

/** Voice conversation client — Gladia Solaria-1 live WebSocket STT, Claude SSE stream, ElevenLabs TTS. */
export function VoiceClient() {
  const router = useRouter();
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartMsRef = useRef<number>(0);
  const historyRef = useRef<Message[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gladiaWsRef = useRef<WebSocket | null>(null);
  // ScriptProcessorNode captures raw PCM from the mic and streams it to Gladia.
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const currentTranscriptRef = useRef<string>("");
  const animFrameRef = useRef<number | null>(null);
  const isProcessingTurnRef = useRef(false);
  const pendingSpeechEndRef = useRef<boolean>(false);

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
      pendingSpeechEndRef.current = false;
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

        // Resume listening for next turn — ScriptProcessorNode resumes automatically
        // because isProcessingTurnRef is cleared before the next onaudioprocess fires.
        isProcessingTurnRef.current = false;
        currentTranscriptRef.current = "";
        setOrbState("listening");
      } catch {
        setError("Something went wrong. Please try again.");
        setOrbState("listening");
        isProcessingTurnRef.current = false;
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

  /** Handle a single message frame from the Gladia WebSocket. */
  const handleGladiaMessage = useCallback(
    (event: MessageEvent) => {
      let msg: unknown;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      const data = msg as {
        type?: string;
        data?: {
          utterance?: { text?: string };
          is_final?: boolean;
        };
      };

      // --- FINAL TRANSCRIPT SEGMENT ---
      // Gladia event: { type: "transcript", data: { is_final: true, utterance: { text: "..." } } }
      if (
        data.type === "transcript" &&
        data.data?.is_final === true &&
        (data.data?.utterance?.text ?? "").trim().length > 0
      ) {
        const segment = data.data.utterance!.text!.trim();
        currentTranscriptRef.current =
          (currentTranscriptRef.current + " " + segment).trim();

        // RACE CONDITION FIX:
        // speech_end already arrived before this is_final —
        // dispatch the turn now, no second speech_end is coming.
        if (pendingSpeechEndRef.current && !isProcessingTurnRef.current) {
          pendingSpeechEndRef.current = false;
          const transcript = currentTranscriptRef.current.trim();
          currentTranscriptRef.current = "";
          if (transcript.length > 0) {
            void sendTurn(transcript);
          }
        }
      }

      // --- END OF UTTERANCE ---
      // Gladia event: { type: "speech_end", data: { time: ... } }
      if (data.type === "speech_end" && !isProcessingTurnRef.current) {
        const transcript = currentTranscriptRef.current.trim();

        if (transcript.length > 0) {
          // Happy path: is_final arrived before speech_end
          pendingSpeechEndRef.current = false;
          currentTranscriptRef.current = "";
          void sendTurn(transcript);
        } else {
          // Race: speech_end arrived before is_final — arm the flag.
          // The is_final handler above will dispatch when transcript arrives.
          pendingSpeechEndRef.current = true;
        }
      }
    },
    [sendTurn]
  );

  /**
   * Open a Gladia live WebSocket session directly from the browser.
   *
   * Auth flow: our server POSTs to Gladia with the secret key and receives a
   * temporary per-session WebSocket URL. The browser connects to that URL —
   * GLADIA_API_KEY never appears in a URL or client bundle.
   *
   * Audio: raw 16-bit PCM at 16 000 Hz captured via ScriptProcessorNode and
   * sent as binary ArrayBuffer frames. Gladia's endpointing (1.0 s silence)
   * fires a speech_end event which triggers each conversation turn.
   */
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
          if (!audioCtx) {
            ws.close();
            reject(new Error("AudioContext not initialised"));
            return;
          }

          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          // ScriptProcessorNode captures 2 048-sample PCM frames (~128 ms at
          // 16 000 Hz) and sends them as binary to Gladia.
          // createScriptProcessor is deprecated but universally supported;
          // audio is not sent while a turn is being processed so Gladia's
          // endpointing timer resets cleanly between turns.
          const processor = audioCtx.createScriptProcessor(2048, 1, 1);
          source.connect(processor);
          processor.connect(audioCtx.destination);
          scriptProcessorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN && !isProcessingTurnRef.current) {
              const pcm = floatTo16BitPCM(e.inputBuffer.getChannelData(0));
              ws.send(pcm);
            }
          };

          startAmplitudeLoop(analyser);
          resolve();
        };

        ws.onmessage = (e: MessageEvent) => {
          handleGladiaMessage(e);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          setError("Transcription connection lost. Please try again.");
          setOrbState("idle");
          reject(new Error("Gladia WebSocket error during open"));
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
    setError(null);

    let stream: MediaStream | undefined;

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

      // 4. Activate microphone and create AudioContext at 16 000 Hz to match
      //    Gladia's session config (wav/pcm, 16-bit, 16 kHz, mono).
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

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

    if (!stream) return;

    // 5. Connect to Gladia — isolated so a WebSocket rejection does not show
    //    the generic "could not start" error
    try {
      await connectGladia(stream);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ action: "voice.begin.connectGladia.error", error: message });
      setError("Could not connect to transcription service. Please try again.");
      setOrbState("idle");
      cleanup();
    }
  }, [connectGladia, playAudio, cleanup]);

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
