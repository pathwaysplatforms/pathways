'use client';

import { useState, useRef, useEffect } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { ChatInput } from './ChatInput';
import { MarkdownMessage } from './MarkdownMessage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

const SUGGESTED_QUESTIONS = [
  'What documents do I need for my next step?',
  'How long does the background check take?',
  'Can I travel outside Canada while my application is in progress?',
] as const;

function formatSourceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean).slice(0, 3);
    const path = segments.length > 0 ? '/' + segments.join('/') : '';
    return parsed.hostname + path + (segments.length === 3 ? '…' : '');
  } catch {
    return url;
  }
}

/** Full-page chat interface for the Ask Pathways feature. */
export function AskPageClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function handleSubmit(value: string) {
    if (!value || isLoading) return;

    setError(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: value,
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: value,
          conversationHistory: messages.map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = (await response.json()) as {
        answer?: string;
        sources?: string[];
        error?: { message: string };
      };

      if (!response.ok || data.error) {
        setError(data.error?.message ?? 'Something went wrong. Please try again.');
        setIsLoading(false);
        return;
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer ?? '',
        sources: data.sources ?? [],
      };
      setMessages([...newMessages, assistantMessage]);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes pwDotPulse { 0%,80%,100% { opacity:0.2 } 40% { opacity:1 } }
        .pw-ask-dot-1 { animation: pwDotPulse 1.2s ease-in-out infinite 0ms; }
        .pw-ask-dot-2 { animation: pwDotPulse 1.2s ease-in-out infinite 150ms; }
        .pw-ask-dot-3 { animation: pwDotPulse 1.2s ease-in-out infinite 300ms; }

        .pw-suggestion-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
          font-family: var(--pw-font-body);
          font-size: 13px;
          color: #374151;
          line-height: 1.5;
          transition: color 150ms cubic-bezier(0.16,1,0.3,1);
          width: 100%;
        }
        .pw-suggestion-btn:hover:not(:disabled) {
          color: #0F0F0F;
        }
        .pw-suggestion-btn .pw-suggestion-bar {
          width: 2px;
          height: 16px;
          background: #E5E7EB;
          flex-shrink: 0;
          transition: background 150ms cubic-bezier(0.16,1,0.3,1);
        }
        .pw-suggestion-btn:hover:not(:disabled) .pw-suggestion-bar {
          background: #1A56DB;
        }
        .pw-suggestion-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pw-source-link {
          font-family: var(--pw-font-body);
          font-size: 11px;
          color: #6B7280;
          display: block;
          margin-bottom: 2px;
          text-decoration: none;
        }
        .pw-source-link:hover {
          color: #1A56DB;
          text-decoration: underline;
        }

        .pw-md-link { color: #1A56DB; text-decoration: underline; text-underline-offset: 2px; }
        .pw-md-link:hover { color: #1345B5; }
        .pw-md-bold { font-weight: 600; color: #0F0F0F; }
        .pw-md-p {
          font-family: var(--pw-font-body);
          font-size: 14px;
          line-height: 1.75;
          color: #374151;
          margin-bottom: 12px;
        }
        .pw-md-p:last-child { margin-bottom: 0; }
        .pw-md-heading {
          font-family: var(--pw-font-body);
          font-size: 14px;
          line-height: 1.75;
          color: #0F0F0F;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .pw-md-ul, .pw-md-ol {
          margin-left: 16px;
          margin-top: 8px;
          margin-bottom: 8px;
          padding-left: 0;
        }
        .pw-md-ul { list-style-type: disc; }
        .pw-md-ol { list-style-type: decimal; }
        .pw-md-li {
          font-family: var(--pw-font-body);
          font-size: 14px;
          line-height: 1.75;
          color: #374151;
          margin-bottom: 4px;
        }
      `}</style>

      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* ── Left column (desktop only) ── */}
        <aside
          className="hidden lg:flex flex-col pw-glass-panel pw-glass-panel--sidebar"
          style={{
            width: 300,
            flexShrink: 0,
            overflowY: 'auto',
          }}
        >
          {/* Header block */}
          <div style={{ paddingTop: 40, paddingLeft: 32, paddingRight: 24 }}>
            <h1
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontSize: 28,
                fontWeight: 400,
                color: '#0F0F0F',
                margin: '0 0 8px',
                lineHeight: 1.2,
              }}
            >
              Ask Pathways
            </h1>
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 13,
                color: '#6B7280',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Ask anything about your immigration application. Answers are grounded in official IRCC documentation.
            </p>
          </div>

          {/* Suggested questions */}
          <div style={{ marginTop: 40, paddingLeft: 32, paddingRight: 24 }}>
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 10,
                fontWeight: 500,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                margin: '0 0 16px',
              }}
            >
              Suggested
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="pw-suggestion-btn"
                  onClick={() => void handleSubmit(q)}
                  disabled={isLoading}
                >
                  <span className="pw-suggestion-bar" />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Disclaimer — pinned to bottom */}
          <div
            style={{
              marginTop: 'auto',
              borderTop: '1px solid #E5E7EB',
              padding: '16px 24px 40px 32px',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Lock size={12} style={{ color: '#9CA3AF', flexShrink: 0, marginTop: 1 }} />
              <p
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 11,
                  color: '#9CA3AF',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                General information only, not legal advice. Consult a licensed immigration consultant for your specific situation.
              </p>
            </div>
          </div>
        </aside>

        {/* ── Right column — chat ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Mobile header (hidden on desktop) */}
          <div
            className="flex lg:hidden items-center"
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E5E7EB',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontSize: 18,
                fontWeight: 400,
                color: '#0F0F0F',
              }}
            >
              Ask Pathways
            </span>
          </div>

          {/* Messages area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: messages.length === 0 && !isLoading ? 0 : '32px 40px 0',
            }}
          >
            {messages.length === 0 && !isLoading ? (
              /* Empty state */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  padding: '40px 28px',
                }}
              >
                {/* Hairline cross mark */}
                <div style={{ position: 'relative', width: 24, height: 24, marginBottom: 24, flexShrink: 0 }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      width: 24,
                      height: 1,
                      background: '#E5E7EB',
                      transform: 'translateY(-50%)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      width: 1,
                      height: 24,
                      background: '#E5E7EB',
                      transform: 'translateX(-50%)',
                    }}
                  />
                </div>
                <h2
                  style={{
                    fontFamily: 'var(--pw-font-display)',
                    fontSize: 36,
                    fontWeight: 400,
                    color: '#0F0F0F',
                    margin: '0 0 12px',
                    lineHeight: 1.2,
                    maxWidth: 400,
                  }}
                >
                  What would you like to know?
                </h2>
                <p
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: 14,
                    color: '#9CA3AF',
                    margin: 0,
                    maxWidth: 360,
                    lineHeight: 1.6,
                  }}
                >
                  Ask about documents, timelines, eligibility, or any step in your application.
                </p>
              </div>
            ) : (
              /* Message list */
              <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 20 }}>
                {messages.map((msg) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
                        <div
                          style={{
                            maxWidth: '65%',
                            borderLeft: '2px solid #1A56DB',
                            padding: '0 0 0 12px',
                          }}
                        >
                          <p
                            style={{
                              fontFamily: 'var(--pw-font-body)',
                              fontSize: 14,
                              color: '#0F0F0F',
                              margin: 0,
                              wordBreak: 'break-word',
                            }}
                          >
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const uniqueSources = Array.from(new Set(msg.sources ?? []));
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 32 }}>
                      <div style={{ maxWidth: '75%' }}>
                        <div
                          style={{
                            wordBreak: 'break-word',
                            marginBottom: uniqueSources.length > 0 ? 8 : 0,
                          }}
                        >
                          <MarkdownMessage content={msg.content} />
                        </div>
                        {uniqueSources.length > 0 && (
                          <div>
                            <p
                              style={{
                                fontFamily: 'var(--pw-font-body)',
                                fontSize: 10,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                color: '#9CA3AF',
                                margin: '0 0 6px',
                              }}
                            >
                              Sources
                            </p>
                            {uniqueSources.map((src) => (
                              <a
                                key={src}
                                href={src}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pw-source-link"
                                title={src}
                              >
                                {formatSourceUrl(src)}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator — CSS-only animation, no box */}
                {isLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 32 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                      aria-label="Thinking…"
                    >
                      <span
                        className="pw-ask-dot-1"
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: '#D1D5DB',
                          display: 'inline-block',
                        }}
                      />
                      <span
                        className="pw-ask-dot-2"
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: '#D1D5DB',
                          display: 'inline-block',
                        }}
                      />
                      <span
                        className="pw-ask-dot-3"
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: '#D1D5DB',
                          display: 'inline-block',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Error state — inline below last message */}
                {error && (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}
                    role="alert"
                  >
                    <AlertCircle size={12} style={{ color: '#DC2626', flexShrink: 0 }} />
                    <span
                      style={{
                        fontFamily: 'var(--pw-font-body)',
                        fontSize: 12,
                        color: '#DC2626',
                      }}
                    >
                      {error}
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Error state when no messages yet */}
          {error && messages.length === 0 && (
            <div
              style={{ padding: '0 24px', flexShrink: 0 }}
              role="alert"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <AlertCircle size={12} style={{ color: '#DC2626', flexShrink: 0 }} />
                <span
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: 12,
                    color: '#DC2626',
                  }}
                >
                  {error}
                </span>
              </div>
            </div>
          )}

          {/* Input area — sticky bottom */}
          <div
            style={{
              flexShrink: 0,
              padding: '16px 24px 24px',
            }}
          >
            <ChatInput
              onSubmit={handleSubmit}
              isLoading={isLoading}
              placeholder="Ask a question about your application..."
            />
          </div>
        </div>
      </div>
    </>
  );
}
