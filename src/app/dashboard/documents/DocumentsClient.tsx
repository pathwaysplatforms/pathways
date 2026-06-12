'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { DashboardDocument } from '@/modules/dashboard/types';

// ─── Document definitions ─────────────────────────────────────────────────────

type DocStatus = 'not_uploaded' | 'uploading' | 'uploaded' | 'verified';

interface DocDef {
  id: string;
  name: string;
  description: string;
}

interface DocCategory {
  label: string;
  docs: DocDef[];
}

const DOCUMENT_CATEGORIES: DocCategory[] = [
  {
    label: 'Identity',
    docs: [
      { id: 'passport', name: 'Passport', description: 'Valid for 6+ months' },
      { id: 'birth-cert', name: 'Birth certificate', description: 'Official government-issued copy' },
    ],
  },
  {
    label: 'Language',
    docs: [
      { id: 'language-test', name: 'IELTS / CELPIP test results', description: 'Test Report Form (TRF)' },
    ],
  },
  {
    label: 'Education',
    docs: [
      { id: 'degree', name: 'Degree certificates', description: 'All post-secondary degrees' },
      { id: 'eca', name: 'ECA report', description: 'If applicable — from WES or approved body' },
    ],
  },
  {
    label: 'Work Experience',
    docs: [
      { id: 'reference-letters', name: 'Reference letters', description: 'One per employer, on letterhead' },
      { id: 'paystubs', name: 'Pay stubs or T4s', description: 'Last 12 months of employment' },
    ],
  },
  {
    label: 'Financial',
    docs: [
      { id: 'proof-of-funds', name: 'Proof of funds', description: 'Bank statement, last 3 months' },
    ],
  },
];

const ALL_DOCS = DOCUMENT_CATEGORIES.flatMap((c) => c.docs);
const TOTAL = ALL_DOCS.length;

/** Matches a hardcoded document against uploaded DB records by name similarity. */
function getInitialStatus(docName: string, dbDocs: DashboardDocument[]): DocStatus {
  const lower = docName.toLowerCase();
  const match = dbDocs.find(
    (d) =>
      d.name.toLowerCase().includes(lower) || lower.includes(d.name.toLowerCase())
  );
  if (!match) return 'not_uploaded';
  if (match.status === 'verified') return 'verified';
  if (match.status === 'uploaded') return 'uploaded';
  return 'not_uploaded';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DocumentsClientProps {
  hasApplication: boolean;
  dbDocuments: DashboardDocument[];
}

/** Document checklist with per-file upload simulation. */
export function DocumentsClient({ hasApplication, dbDocuments }: DocumentsClientProps) {
  const [statuses, setStatuses] = useState<Record<string, DocStatus>>(() =>
    Object.fromEntries(
      ALL_DOCS.map((doc) => [doc.id, getInitialStatus(doc.name, dbDocuments)])
    )
  );

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    requestAnimationFrame(() => {
      const els = document.querySelectorAll<HTMLElement>('.pw-entry');
      els.forEach((el, i) => {
        setTimeout(() => el.classList.add('is-visible'), i * 40);
      });
    });
  }, []);

  function handleUploadClick(docId: string) {
    fileInputRefs.current[docId]?.click();
  }

  function handleFileChange(docId: string, e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setStatuses((prev) => ({ ...prev, [docId]: 'uploading' }));
    setTimeout(() => {
      setStatuses((prev) => ({ ...prev, [docId]: 'uploaded' }));
      // TODO: upload to Supabase Storage
    }, 600);
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  }

  const uploadedCount = Object.values(statuses).filter(
    (s) => s === 'uploaded' || s === 'verified'
  ).length;

  // ── No pathway state ────────────────────────────────────────────────────────

  if (!hasApplication) {
    return (
      <div className="flex-1 overflow-y-auto p-[28px] relative z-10">
        <div style={{ maxWidth: 520 }}>
          <div
            className="pw-entry"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}
          >
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#9B9B9B',
              }}
            >
              DOCUMENTS
            </p>

            <span
              style={{
                fontSize: 32,
                color: 'rgba(0,0,0,0.12)',
                lineHeight: 1,
                userSelect: 'none',
              }}
              aria-hidden="true"
            >
              ⊘
            </span>

            <h1
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontSize: '1.5rem',
                color: '#0D0D0D',
                lineHeight: 1.2,
              }}
            >
              Unlocks after selecting a pathway.
            </h1>
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 14,
                color: '#6B6B6B',
                lineHeight: 1.6,
              }}
            >
              Your document checklist will appear once you&apos;ve chosen your immigration route.
            </p>
            <Link
              href="/pathways"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 20px',
                fontFamily: 'var(--pw-font-body)',
                fontSize: 14,
                fontWeight: 500,
                color: '#FFFFFF',
                background: '#0D0D0D',
                borderRadius: 9999,
                textDecoration: 'none',
              }}
            >
              Browse pathways →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Document checklist ──────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-[28px] relative z-10">
      <div style={{ maxWidth: 680 }}>
        {/* Header row */}
        <div
          className="pw-entry"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#9B9B9B',
            }}
          >
            DOCUMENTS
          </p>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 12,
              color: '#9B9B9B',
            }}
          >
            {uploadedCount} / {TOTAL} uploaded
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="pw-entry"
          style={{
            height: 2,
            background: 'rgba(0,0,0,0.07)',
            borderRadius: 1,
            overflow: 'hidden',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              height: '100%',
              background: '#0D0D0D',
              borderRadius: 1,
              width: `${Math.round((uploadedCount / TOTAL) * 100)}%`,
              transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>

        {/* Document categories */}
        {DOCUMENT_CATEGORIES.map((category, catIndex) => (
          <div
            key={category.label}
            className="pw-entry"
            style={{ marginBottom: catIndex < DOCUMENT_CATEGORIES.length - 1 ? 32 : 0 }}
          >
            {/* Section header */}
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#9B9B9B',
                marginBottom: 8,
              }}
            >
              {category.label}
            </p>
            <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', marginBottom: 16 }} />

            {/* Document rows */}
            {category.docs.map((doc) => {
              const status = statuses[doc.id] ?? 'not_uploaded';
              const isUploading = status === 'uploading';
              const isUploaded = status === 'uploaded';
              const isVerified = status === 'verified';
              const isDone = isUploaded || isVerified;

              return (
                <div key={doc.id}>
                  {/* Hidden file input */}
                  <input
                    ref={(el) => {
                      fileInputRefs.current[doc.id] = el;
                    }}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileChange(doc.id, e)}
                    aria-label={`Upload ${doc.name}`}
                  />

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      padding: '10px 0',
                      borderBottom: '1px solid rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Left: status dot + doc name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: isDone ? '#0D0D0D' : 'rgba(0,0,0,0.12)',
                          flexShrink: 0,
                          transition: 'background 300ms ease',
                        }}
                      />
                      <div>
                        <p
                          style={{
                            fontFamily: 'var(--pw-font-body)',
                            fontSize: 14,
                            color: '#0D0D0D',
                            marginBottom: 1,
                          }}
                        >
                          {doc.name}
                        </p>
                        <p
                          style={{
                            fontFamily: 'var(--pw-font-body)',
                            fontSize: 11,
                            color: '#9B9B9B',
                          }}
                        >
                          {doc.description}
                        </p>
                      </div>
                    </div>

                    {/* Right: status badge + action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {isUploading && (
                        <span
                          style={{
                            fontFamily: 'var(--pw-font-body)',
                            fontSize: 10,
                            color: '#9B9B9B',
                          }}
                        >
                          Uploading…
                        </span>
                      )}
                      {isUploaded && (
                        <span
                          style={{
                            fontFamily: 'var(--pw-font-body)',
                            fontSize: 10,
                            color: '#9B9B9B',
                          }}
                        >
                          Uploaded
                        </span>
                      )}
                      {isVerified && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            fontFamily: 'var(--pw-font-body)',
                            fontSize: 10,
                            color: '#FFFFFF',
                            background: '#0D0D0D',
                            borderRadius: 4,
                          }}
                        >
                          Verified
                        </span>
                      )}

                      {!isVerified && !isUploading && (
                        <button
                          type="button"
                          onClick={() => handleUploadClick(doc.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            fontFamily: 'var(--pw-font-body)',
                            fontSize: 10,
                            color: isDone ? '#9B9B9B' : '#0D0D0D',
                            background: 'transparent',
                            border: '1px solid rgba(0,0,0,0.12)',
                            borderRadius: 9999,
                            cursor: 'pointer',
                          }}
                        >
                          {isDone ? 'Replace' : 'Upload'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
