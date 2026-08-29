'use client';

import { useRef, useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface ChatInputProps {
  onSubmit: (value: string) => void;
  isLoading: boolean;
  placeholder?: string;
  disabled?: boolean;
}

/** Autogrow pill-shaped chat textarea with floating shadow and dark send button. */
export function ChatInput({ onSubmit, isLoading, placeholder, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = value.trim().length > 0 && !isLoading && !disabled;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // 4 lines max (22px line-height × 4 + 16px padding buffer)
    el.style.height = `${Math.min(el.scrollHeight, 104)}px`;
  }, [value]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    onSubmit(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <>
      <style>{`
        @keyframes pw-pill-spin {
          to { transform: rotate(360deg); }
        }
        .pw-pill-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #FFFFFF;
          border-radius: 50%;
          animation: pw-pill-spin 600ms linear infinite;
          display: block;
          flex-shrink: 0;
        }
        .pw-pill-form .pw-pill-container {
          width: 75%;
          margin: 0 auto;
          background: #FFFFFF;
          border-radius: 24px;
          box-shadow: 0 2px 4px -1px rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.03);
          transition: width 380ms cubic-bezier(0.16,1,0.3,1),
                      box-shadow 280ms cubic-bezier(0.16,1,0.3,1);
        }
        .pw-pill-form:hover .pw-pill-container {
          width: 100%;
          box-shadow: 0 8px 18px -2px rgba(0,0,0,0.09), 0 4px 6px -1px rgba(0,0,0,0.05),
                      0 0 18px 2px rgba(26,86,219,0.10);
        }
        .pw-pill-form:focus-within .pw-pill-container {
          width: 100%;
          box-shadow: 0 0 0 2px rgba(26,86,219,0.10), 0 8px 18px -2px rgba(0,0,0,0.08),
                      0 0 24px 4px rgba(26,86,219,0.14);
        }
        .pw-pill-send:not(:disabled):hover {
          background: #1A1A1A !important;
        }
        .pw-pill-form .pw-pill-container textarea::placeholder {
          color: #C4C9D4;
        }
      `}</style>
      <form className="pw-pill-form" onSubmit={handleSubmit} style={{ width: '100%' }}>
        <div
          className="pw-pill-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 12px 12px 20px',
            gap: 8,
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? 'Ask a question about your application...'}
            aria-label="Ask a question about your application"
            rows={1}
            style={{
              flex: 1,
              fontFamily: 'var(--pw-font-body)',
              fontSize: 15,
              lineHeight: '22px',
              color: '#0F0F0F',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              minHeight: 22,
              maxHeight: 104,
              padding: 0,
              overflowY: 'auto',
            }}
            disabled={disabled ?? isLoading}
          />
          <button
            type="submit"
            className="pw-pill-send"
            disabled={!canSubmit}
            aria-label="Send message"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              background: canSubmit ? '#0F0F0F' : '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms ease',
            }}
          >
            {isLoading ? (
              <span className="pw-pill-spinner" />
            ) : (
              <ArrowUp size={16} color={canSubmit ? '#FFFFFF' : '#D1D5DB'} />
            )}
          </button>
        </div>
      </form>
    </>
  );
}
