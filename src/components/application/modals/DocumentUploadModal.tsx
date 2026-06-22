'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import type { DocumentRequirement } from '@/modules/pathways/types';

type ModalState = 'idle' | 'uploading' | 'success' | 'error';

interface Props {
  document: DocumentRequirement;
  onClose: () => void;
  onSuccess: () => void;
}

/** Full document upload modal with three sections and four states (idle/uploading/success/error). */
export function DocumentUploadModal({ document, onClose, onSuccess }: Props) {
  const [modalState, setModalState] = useState<ModalState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-close 2 s after success
  useEffect(() => {
    if (modalState !== 'success') return;
    const t = setTimeout(onSuccess, 2000);
    return () => clearTimeout(t);
  }, [modalState, onSuccess]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setModalState('idle');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile || modalState !== 'idle') return;
    setModalState('uploading');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (document.document_type) formData.append('document_type', document.document_type);
      const res = await fetch('/api/vault/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(json?.error?.message ?? 'Upload failed');
      }
      setModalState('success');
    } catch {
      setModalState('error');
    }
  }, [selectedFile, modalState, document.document_type]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isUploading = modalState === 'uploading';
  const isSuccess = modalState === 'success';
  const isError = modalState === 'error';
  const canUpload = !!selectedFile && modalState === 'idle';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isUploading) onClose(); }}
    >
      <div
        className="bg-bg-surface rounded-panel w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: 'var(--shadow-card-lg)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-light">
          <h2 className="text-text-primary font-bold" style={{ fontSize: '18px' }}>
            {document.name}
          </h2>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="w-8 h-8 rounded-icon flex items-center justify-center text-text-tertiary hover:bg-bg-subtle hover:text-text-secondary transition-colors disabled:opacity-40"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 flex flex-col gap-6">

          {/* Section A — What this document is */}
          <div>
            <p className="label-eyebrow mb-3">What this document is</p>
            <p className="text-text-secondary" style={{ fontSize: '14px', lineHeight: '1.65' }}>
              {document.description}
            </p>
            {document.validity_period && (
              <span
                className="inline-flex items-center bg-bg-subtle rounded-badge px-3 py-1 mt-3"
              >
                <span className="text-text-secondary" style={{ fontSize: '12px' }}>
                  Valid for: <strong>{document.validity_period}</strong>
                </span>
              </span>
            )}
            <p className="mt-3" style={{ fontSize: '12px' }}>
              <button
                className="text-accent-600 hover:text-accent-500 transition-colors"
                onClick={() => {/* stub */}}
              >
                Not sure what this is? Get help →
              </button>
            </p>
          </div>

          {/* Section B — AI Document Support */}
          <div
            className="rounded-card p-5"
            style={{
              background: 'var(--color-accent-50)',
              border: '1px solid var(--color-accent-100)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={15} className="text-accent-500" />
              <p className="text-accent-700 font-bold" style={{ fontSize: '14px' }}>
                AI Document Support
              </p>
            </div>
            <ul className="mb-4 space-y-1.5">
              {[
                'Understand exactly what version of this document you need',
                'Generate a template or covering letter (where applicable)',
                'Check if your document meets requirements before uploading',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    className="text-accent-400 flex-shrink-0 font-bold"
                    style={{ fontSize: '14px', lineHeight: '1.5' }}
                  >
                    ·
                  </span>
                  <span className="text-text-secondary" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => setAiMessage('Coming soon — this feature is being built.')}
              >
                Ask AI about this document
              </button>
              <button
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => setAiMessage('Coming soon — template generation is in progress.')}
              >
                Generate template
              </button>
            </div>
            {aiMessage && (
              <p className="text-accent-600 mt-3" style={{ fontSize: '12px', fontWeight: 500 }}>
                {aiMessage}
              </p>
            )}
          </div>

          {/* Section C — Upload */}
          <div>
            <p className="label-eyebrow mb-3">Upload your document</p>

            {isSuccess ? (
              /* Success state */
              <div className="flex flex-col items-center gap-3 py-10">
                <CheckCircle2 size={48} style={{ color: '#22C55E' }} />
                <p className="text-text-primary font-bold" style={{ fontSize: '16px' }}>
                  Document uploaded successfully!
                </p>
                <p className="text-text-tertiary" style={{ fontSize: '13px' }}>
                  Closing automatically…
                </p>
              </div>
            ) : isError ? (
              /* Error state */
              <div className="flex flex-col items-center gap-3 py-8">
                <XCircle size={40} style={{ color: '#EF4444' }} />
                <p className="text-text-primary font-bold" style={{ fontSize: '15px' }}>
                  Upload failed
                </p>
                <p className="text-text-tertiary" style={{ fontSize: '13px' }}>
                  Something went wrong. Please try again.
                </p>
                <button
                  onClick={() => { setSelectedFile(null); setModalState('idle'); }}
                  className="btn-secondary"
                  style={{ fontSize: '13px' }}
                >
                  Try again
                </button>
              </div>
            ) : (
              /* Idle / uploading states */
              <>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={isUploading ? undefined : () => fileInputRef.current?.click()}
                  className={[
                    'border-2 border-dashed rounded-card transition-colors',
                    isUploading ? 'cursor-default' : 'cursor-pointer',
                    isDragging
                      ? 'border-accent-400 bg-accent-50'
                      : 'border-border hover:border-accent-300 hover:bg-bg-subtle',
                  ].join(' ')}
                  style={{ padding: '28px 20px' }}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full border-2 border-border animate-spin"
                        style={{ borderTopColor: 'var(--color-accent-500)' }}
                      />
                      <p className="text-text-secondary" style={{ fontSize: '14px' }}>
                        Uploading…
                      </p>
                    </div>
                  ) : selectedFile ? (
                    /* File preview */
                    <div
                      className="flex items-center gap-3 bg-bg-surface rounded-btn px-4 py-3"
                      style={{ boxShadow: 'var(--shadow-card)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText size={20} className="text-accent-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-text-primary font-semibold truncate"
                          style={{ fontSize: '13px' }}
                        >
                          {selectedFile.name}
                        </p>
                        <p className="text-text-tertiary" style={{ fontSize: '11px' }}>
                          {formatBytes(selectedFile.size)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                        className="w-6 h-6 rounded flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-subtle transition-colors flex-shrink-0"
                        aria-label="Remove file"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    /* Empty drop zone */
                    <div className="flex flex-col items-center gap-2 text-center">
                      <UploadCloud size={32} className="text-text-disabled" />
                      <p className="text-text-secondary" style={{ fontSize: '14px' }}>
                        Drag and drop your file here
                      </p>
                      <p className="text-text-tertiary" style={{ fontSize: '12px' }}>
                        or{' '}
                        <span className="text-accent-600 font-semibold">click to browse</span>
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-text-tertiary mt-2" style={{ fontSize: '11px' }}>
                  Accepted: {document.accepted_formats.join(', ')} · Max {document.max_size_mb} MB
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept={document.accepted_formats.map((f) => `.${f.toLowerCase()}`).join(',')}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        {!isSuccess && (
          <div className="flex items-center justify-between px-6 py-5 border-t border-border-light">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
              style={{ fontSize: '14px', fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!canUpload}
              className={`btn-primary ${!canUpload ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ fontSize: '14px' }}
            >
              {isUploading ? 'Uploading…' : 'Upload Document'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
