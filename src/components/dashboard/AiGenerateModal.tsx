'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Copy, Check, RotateCcw } from 'lucide-react';
import type { AiActionType } from '@/modules/dashboard/types';

interface AiGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Title shown in the modal header. */
  title: string;
  actionType: AiActionType;
  stepId: string;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'ok'; output: string }
  | { status: 'error'; message: string };

const ACCENT = '#1A56DB';
const AI_TEAL = '#14909C';   // platform's design-system teal (--color-accent-500) — matches the trigger button
const GREEN = '#16A34A';
const INK = '#0A0A0A';
const MUTED = '#6B7280';
const PILL = 999;

/** Full-screen modal with blurred backdrop that streams an AI-generated draft. */
export function AiGenerateModal({ isOpen, onClose, title, actionType, stepId }: AiGenerateModalProps) {
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'loading' });
  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFetchState({ status: 'loading' });

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: actionType, step_id: stepId }),
        signal: controller.signal,
      });
      const json = await res.json() as { output?: string; error?: { message: string } };
      if (!res.ok || !json.output) {
        setFetchState({ status: 'error', message: json.error?.message ?? 'Generation failed. Please try again.' });
        return;
      }
      setFetchState({ status: 'ok', output: json.output });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setFetchState({ status: 'error', message: 'Network error. Please try again.' });
    }
  }, [actionType, stepId]);

  // Trigger generation when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setIsClosing(false);
    void generate();
    return () => { abortRef.current?.abort(); };
  }, [isOpen, generate]);

  // Trap focus inside panel.
  useEffect(() => {
    if (!isOpen) return;
    const el = panelRef.current;
    if (el) el.focus();
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleClose() {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setCopied(false);
      onClose();
    }, 160);
  }

  async function handleCopy() {
    if (fetchState.status !== 'ok') return;
    await navigator.clipboard.writeText(fetchState.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isOpen && !isClosing) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`pw-modal-backdrop${isClosing ? ' is-closing' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        background: 'rgba(10,10,10,0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`pw-modal-panel${isClosing ? ' is-closing' : ''}`}
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: 'calc(100vh - 80px)',
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 20px 14px',
          flexShrink: 0,
        }}>
          <div style={{ width: 24, flexShrink: 0 }} />
          <p style={{ flex: 1, fontFamily: 'var(--pw-font-display)', fontSize: 15, fontWeight: 500, color: INK, margin: 0, textAlign: 'center', lineHeight: 1.3 }}>
            {title}
          </p>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            style={{
              width: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={16} color={MUTED} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {fetchState.status === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: `2.5px solid rgba(26,86,219,0.15)`,
                borderTop: `2.5px solid ${ACCENT}`,
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: MUTED, margin: 0 }}>
                Drafting your document…
              </p>
            </div>
          )}

          {fetchState.status === 'error' && (
            <div style={{
              background: 'rgba(208,0,12,0.05)',
              border: '1px solid rgba(208,0,12,0.15)',
              borderRadius: 12,
              padding: '16px 18px',
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: '#D0000C', margin: 0 }}>
                {fetchState.message}
              </p>
              <button
                type="button"
                onClick={() => void generate()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 14px',
                  borderRadius: PILL,
                  border: '1px solid rgba(208,0,12,0.2)',
                  background: 'transparent',
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#D0000C',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={11} /> Try again
              </button>
            </div>
          )}

          {fetchState.status === 'ok' && (
            <pre
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 13,
                lineHeight: 1.75,
                color: INK,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                background: 'rgba(0,0,0,0.02)',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 12,
                padding: '14px 16px',
              }}
            >
              {fetchState.output}
            </pre>
          )}
        </div>

        {/* Footer */}
        {fetchState.status === 'ok' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px 16px',
            borderTop: '1px solid rgba(0,0,0,0.07)',
            flexShrink: 0,
            gap: 10,
          }}>
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, color: MUTED, margin: 0 }}>
              Fill in any <span style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>[PLACEHOLDER]</span> fields before sending.
            </p>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => void generate()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  height: 32,
                  padding: '0 14px',
                  borderRadius: PILL,
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: 'transparent',
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: MUTED,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={11} /> Regenerate
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 32,
                  padding: '0 16px',
                  borderRadius: PILL,
                  border: 'none',
                  background: copied ? GREEN : AI_TEAL,
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                  boxShadow: copied ? '0 2px 8px rgba(22,163,74,0.25)' : '0 2px 8px rgba(8,145,178,0.25)',
                  transition: 'background 200ms ease, box-shadow 200ms ease',
                }}
              >
                {copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy draft</>}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
