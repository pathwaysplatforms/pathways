'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { DOCUMENT_TYPE_OPTIONS, DOCUMENT_TYPE_LABEL, MAX_FILES_PER_USER } from '@/modules/vault/types';
import type { VaultFile } from '@/modules/vault/types';

interface DocumentsClientProps {
  initialFiles: VaultFile[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Searchable document-type combobox ──────────────────────────────────────────

interface ComboboxProps {
  fileId: string;
  value: string | null;
  disabled: boolean;
  onChange: (fileId: string, value: string | null) => void;
}

function DocTypeCombobox({ fileId, value, disabled, onChange }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const filtered = search.trim()
    ? DOCUMENT_TYPE_OPTIONS.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : DOCUMENT_TYPE_OPTIONS;

  const currentLabel = value ? (DOCUMENT_TYPE_LABEL[value] ?? value) : null;

  function select(v: string | null) {
    onChange(fileId, v);
    setIsOpen(false);
    setSearch('');
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', maxWidth: 280 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setIsOpen((o) => !o); }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Document type for file`}
        style={{
          width: '100%',
          textAlign: 'left',
          fontFamily: 'var(--pw-font-body)',
          fontSize: 11,
          color: value ? '#0D0D0D' : '#9B9B9B',
          background: 'transparent',
          border: '1px solid rgba(0,0,0,0.14)',
          borderRadius: 6,
          padding: '3px 22px 3px 6px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          position: 'relative',
        }}
      >
        {currentLabel ?? '— Label this document —'}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 8,
            color: '#9B9B9B',
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.14)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '5px 8px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setIsOpen(false); setSearch(''); }
              }}
              style={{
                width: '100%',
                fontFamily: 'var(--pw-font-body)',
                fontSize: 11,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: '#0D0D0D',
              }}
            />
          </div>
          <ul
            role="listbox"
            style={{ maxHeight: 200, overflowY: 'auto', padding: '3px 0', margin: 0, listStyle: 'none' }}
          >
            {value && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => select(null)}
                  style={optStyle(false)}
                >
                  — Remove label
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li style={{ padding: '5px 10px', fontFamily: 'var(--pw-font-body)', fontSize: 11, color: '#9B9B9B' }}>
                No matches
              </li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === opt.value}
                    onClick={() => select(opt.value)}
                    style={optStyle(value === opt.value)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function optStyle(selected: boolean): React.CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    padding: '5px 10px',
    fontFamily: 'var(--pw-font-body)',
    fontSize: 11,
    color: selected ? '#0D0D0D' : '#3B3B3B',
    fontWeight: selected ? 500 : 400,
    background: selected ? 'rgba(0,0,0,0.04)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
  };
}

// ── Action button style ────────────────────────────────────────────────────────

function actionBtn(muted = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    fontFamily: 'var(--pw-font-body)',
    fontSize: 10,
    color: muted ? '#C4C4C4' : '#9B9B9B',
    background: 'transparent',
    border: '1px solid rgba(0,0,0,0.10)',
    borderRadius: 9999,
    cursor: muted ? 'default' : 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

/** General-purpose file vault — upload, label, rename, view, download, and manage immigration documents. */
export function DocumentsClient({ initialFiles }: DocumentsClientProps) {
  const [files, setFiles] = useState<VaultFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('.pw-entry').forEach((el, i) => {
        setTimeout(() => el.classList.add('is-visible'), i * 40);
      });
    });
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/vault/upload', { method: 'POST', body: formData });
      const json = await res.json() as { file?: VaultFile; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? 'Upload failed');
      setFiles((prev) => [json.file!, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void uploadFile(file);
      e.target.value = '';
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void uploadFile(file);
    },
    [uploadFile]
  );

  const handleLabelChange = useCallback(async (fileId: string, documentType: string | null) => {
    setPendingLabel(fileId);
    setError(null);
    try {
      const res = await fetch(`/api/vault/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_type: documentType }),
      });
      const json = await res.json() as { file?: VaultFile; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? 'Label update failed');
      setFiles((prev) => prev.map((f) => (f.id === fileId ? (json.file ?? f) : f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update label.');
    } finally {
      setPendingLabel(null);
    }
  }, []);

  const handleDelete = useCallback(async (fileId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/vault/files/${fileId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const json = await res.json() as { error?: { message?: string } };
        throw new Error(json.error?.message ?? 'Delete failed');
      }
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file.');
    }
  }, []);

  const handleView = useCallback(async (fileId: string) => {
    setViewingId(fileId);
    setError(null);
    try {
      const res = await fetch(`/api/vault/signed-url/${fileId}`);
      const json = await res.json() as { url?: string; error?: { message?: string } };
      if (!res.ok || !json.url) throw new Error(json.error?.message ?? 'Failed to get preview link');
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file.');
    } finally {
      setViewingId(null);
    }
  }, []);

  const handleDownload = useCallback(async (file: VaultFile) => {
    setDownloadingId(file.id);
    setError(null);
    try {
      const res = await fetch(`/api/vault/signed-url/${file.id}`);
      const json = await res.json() as { url?: string; error?: { message?: string } };
      if (!res.ok || !json.url) throw new Error(json.error?.message ?? 'Failed to get download link');
      const blobRes = await fetch(json.url);
      const blob = await blobRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = file.displayName ?? file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const handleRenameStart = useCallback((file: VaultFile) => {
    setRenamingId(file.id);
    setRenameValue(file.displayName ?? file.fileName);
  }, []);

  const handleRenameSubmit = useCallback(
    async (fileId: string) => {
      const trimmed = renameValue.trim();
      setRenamingId(null);
      if (!trimmed) return;
      setError(null);
      try {
        const res = await fetch(`/api/vault/files/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name: trimmed }),
        });
        const json = await res.json() as { file?: VaultFile; error?: { message?: string } };
        if (!res.ok) throw new Error(json.error?.message ?? 'Rename failed');
        setFiles((prev) => prev.map((f) => (f.id === fileId ? (json.file ?? f) : f)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename file.');
      }
    },
    [renameValue]
  );

  const atLimit = files.length >= MAX_FILES_PER_USER;

  return (
    <div className="flex-1 overflow-y-auto p-[28px] relative z-10">
      <div style={{ maxWidth: 680 }}>

        {/* Header row */}
        <div
          className="pw-entry"
          style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}
        >
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9B9B9B' }}>
            DOCUMENTS
          </p>
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, color: '#9B9B9B' }}>
            {files.length} / {MAX_FILES_PER_USER} files
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="pw-entry"
            style={{
              padding: '10px 14px',
              background: 'rgba(220,38,38,0.06)',
              border: '1px solid rgba(220,38,38,0.18)',
              borderRadius: 8,
              marginBottom: 16,
              fontFamily: 'var(--pw-font-body)',
              fontSize: 12,
              color: '#DC2626',
            }}
          >
            {error}
          </div>
        )}

        {/* Upload zone */}
        {!atLimit && (
          <div
            className="pw-entry"
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={uploading ? undefined : () => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#0D0D0D' : 'rgba(0,0,0,0.14)'}`,
              borderRadius: 10,
              padding: '28px 20px',
              textAlign: 'center',
              cursor: uploading ? 'default' : 'pointer',
              background: isDragging ? 'rgba(0,0,0,0.03)' : 'transparent',
              transition: 'border-color 200ms ease, background 200ms ease',
              marginBottom: 28,
            }}
          >
            {uploading ? (
              <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: '#9B9B9B' }}>Uploading…</p>
            ) : (
              <>
                <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#0D0D0D', marginBottom: 4 }}>
                  Drop a file here or{' '}
                  <span style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>click to browse</span>
                </p>
                <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, color: '#9B9B9B' }}>
                  PDF, JPEG, or PNG · Max 10 MB
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileInput}
              aria-label="Upload document"
            />
          </div>
        )}

        {atLimit && (
          <div
            className="pw-entry"
            style={{
              padding: '10px 14px',
              background: 'rgba(0,0,0,0.04)',
              borderRadius: 8,
              marginBottom: 28,
              fontFamily: 'var(--pw-font-body)',
              fontSize: 12,
              color: '#6B6B6B',
            }}
          >
            Vault is full ({MAX_FILES_PER_USER} files). Delete a file to upload a new one.
          </div>
        )}

        {/* File list */}
        {files.length === 0 ? (
          <div className="pw-entry" style={{ paddingTop: 8 }}>
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#9B9B9B' }}>
              No documents yet. Upload your first file to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Column labels */}
            <div
              className="pw-entry"
              style={{ display: 'grid', gridTemplateColumns: '1fr auto', marginBottom: 8 }}
            >
              <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#C4C4C4' }}>
                File
              </p>
              <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#C4C4C4' }}>
                Actions
              </p>
            </div>

            <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', marginBottom: 4 }} />

            {files.map((file) => (
              <div
                key={file.id}
                className="pw-entry"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid rgba(0,0,0,0.05)',
                }}
              >
                {/* Status dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: file.documentType ? '#0D0D0D' : 'rgba(0,0,0,0.15)',
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />

                {/* File info + label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Inline-editable display name */}
                  {renamingId === file.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => void handleRenameSubmit(file.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRenameSubmit(file.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      style={{
                        fontFamily: 'var(--pw-font-body)',
                        fontSize: 13,
                        color: '#0D0D0D',
                        border: 'none',
                        borderBottom: '1px solid rgba(0,0,0,0.25)',
                        outline: 'none',
                        background: 'transparent',
                        width: '100%',
                        marginBottom: 4,
                        padding: '0 0 2px',
                      }}
                      aria-label="Edit file name"
                    />
                  ) : (
                    <p
                      title={file.displayName ?? file.fileName}
                      onClick={() => handleRenameStart(file)}
                      style={{
                        fontFamily: 'var(--pw-font-body)',
                        fontSize: 13,
                        color: '#0D0D0D',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: 4,
                        cursor: 'text',
                      }}
                    >
                      {file.displayName ?? file.fileName}
                      {file.displayName && file.displayName !== file.fileName && (
                        <span style={{ fontFamily: 'var(--pw-font-body)', fontSize: 10, color: '#C4C4C4', marginLeft: 6 }}>
                          ({file.fileName})
                        </span>
                      )}
                    </p>
                  )}

                  <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, color: '#9B9B9B', marginBottom: 6 }}>
                    {formatBytes(file.fileSize)} · {formatDate(file.uploadedAt)}
                  </p>

                  {/* Searchable document-type combobox */}
                  <DocTypeCombobox
                    fileId={file.id}
                    value={file.documentType}
                    disabled={pendingLabel === file.id}
                    onChange={handleLabelChange}
                  />
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 160 }}>
                  <button
                    type="button"
                    disabled={viewingId === file.id}
                    onClick={() => void handleView(file.id)}
                    style={actionBtn(viewingId === file.id)}
                  >
                    {viewingId === file.id ? 'Opening…' : 'View'}
                  </button>
                  <button
                    type="button"
                    disabled={downloadingId === file.id}
                    onClick={() => void handleDownload(file)}
                    style={actionBtn(downloadingId === file.id)}
                  >
                    {downloadingId === file.id ? 'Saving…' : 'Download'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(file.id)}
                    style={actionBtn()}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
