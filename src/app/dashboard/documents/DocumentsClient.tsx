'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FileText,
  Image as ImageIcon,
  File,
  Upload,
  X,
  Eye,
  Download,
  Trash2,
} from 'lucide-react';
import { DOCUMENT_TYPE_OPTIONS, DOCUMENT_TYPE_LABEL, MAX_FILES_PER_USER } from '@/modules/vault/types';
import type { VaultFile, DocumentRequirement } from '@/modules/vault/types';
import DisplayCards from '@/components/ui/display-cards';

interface DocumentsClientProps {
  initialFiles: VaultFile[];
  requirements: DocumentRequirement[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Icon element for a file based on its MIME type. */
function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const cls = className ?? 'size-4';
  if (mimeType === 'application/pdf') {
    return <FileText className={cls} style={{ color: 'var(--pw-accent)' }} />;
  }
  if (mimeType.startsWith('image/')) {
    return <ImageIcon className={cls} style={{ color: '#6366f1' }} />;
  }
  return <File className={cls} style={{ color: 'var(--color-text-tertiary)' }} />;
}

/** Background color for the file-type icon circle. */
function iconBg(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'rgba(26,86,219,0.07)';
  if (mimeType.startsWith('image/')) return '#eef2ff';
  return 'var(--color-bg-subtle)';
}

// ── Combobox ────────────────────────────────────────────────────────────────────

interface ComboboxProps {
  fileId: string;
  value: string | null;
  disabled: boolean;
  onChange: (fileId: string, value: string | null) => void;
}

/** Searchable combobox for selecting a document type label. */
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
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setIsOpen((o) => !o); }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Document type"
        className="w-full rounded-badge border px-3 py-1.5 text-left text-xs transition-colors duration-150"
        style={{
          fontFamily: 'var(--pw-font-body)',
          color: value ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
          borderColor: value ? 'rgba(26,86,219,0.3)' : 'var(--color-border-light)',
          background: value ? 'rgba(26,86,219,0.06)' : 'var(--color-bg-subtle)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          paddingRight: 28,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {currentLabel ?? '— Label this document —'}
        <span
          aria-hidden
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px]"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 right-0 z-50 overflow-hidden rounded-card border"
          style={{
            top: 'calc(100% + 4px)',
            background: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-card-lg)',
          }}
        >
          <div className="border-b px-3 py-2" style={{ borderColor: 'var(--color-border-light)' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setIsOpen(false); setSearch(''); } }}
              className="w-full bg-transparent text-xs outline-none"
              style={{ fontFamily: 'var(--pw-font-body)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <ul role="listbox" className="m-0 list-none overflow-y-auto py-1" style={{ maxHeight: 180 }}>
            {value && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => select(null)}
                  className="w-full px-3 py-1.5 text-left text-xs transition-colors duration-100 hover:bg-bg-subtle"
                  style={{ fontFamily: 'var(--pw-font-body)', color: 'var(--color-text-tertiary)' }}
                >
                  — Remove label
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
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
                    className="w-full px-3 py-1.5 text-left text-xs transition-colors duration-100 hover:bg-bg-subtle"
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      color: value === opt.value ? 'var(--pw-accent)' : 'var(--color-text-secondary)',
                      fontWeight: value === opt.value ? 500 : 400,
                      background: value === opt.value ? 'rgba(26,86,219,0.07)' : undefined,
                    }}
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

// ── Expanded card overlay ───────────────────────────────────────────────────────

interface ExpandedCardProps {
  file: VaultFile;
  isExiting: boolean;
  pendingLabel: string | null;
  viewingId: string | null;
  downloadingId: string | null;
  renamingId: string | null;
  renameValue: string;
  onClose: () => void;
  onLabelChange: (fileId: string, value: string | null) => void;
  onView: (fileId: string) => void;
  onDownload: (file: VaultFile) => void;
  onDelete: (fileId: string) => void;
  onRenameStart: (file: VaultFile) => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (fileId: string) => void;
  onRenameCancel: () => void;
}

/** Full-detail overlay that pops open when a vault card is clicked. */
function ExpandedCard({
  file,
  isExiting,
  pendingLabel,
  viewingId,
  downloadingId,
  renamingId,
  renameValue,
  onClose,
  onLabelChange,
  onView,
  onDownload,
  onDelete,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
}: ExpandedCardProps) {
  const isRenaming = renamingId === file.id;

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={isExiting ? 'vault-backdrop-out' : 'vault-backdrop-in'}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.40)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        aria-hidden
      />

      {/* Card */}
      <div
        className={isExiting ? 'vault-card-out' : 'vault-card-in'}
        role="dialog"
        aria-label={`Document: ${file.displayName ?? file.fileName}`}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          pointerEvents: 'none',
        }}
      >
        <div
          className="relative flex flex-col gap-5 rounded-panel"
          style={{
            width: '100%',
            maxWidth: 460,
            background: 'var(--color-bg-surface)',
            boxShadow: 'var(--shadow-card-lg)',
            border: '1px solid var(--color-border-light)',
            padding: '28px',
            pointerEvents: 'auto',
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex size-7 items-center justify-center rounded-full border transition-colors duration-150 hover:bg-bg-subtle"
            style={{
              color: 'var(--color-text-tertiary)',
              borderColor: 'var(--color-border-light)',
              background: 'var(--color-bg-surface)',
            }}
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>

          {/* Icon + name */}
          <div className="flex items-center gap-4 pr-8">
            <span
              className="inline-flex size-12 flex-shrink-0 items-center justify-center rounded-card"
              style={{ background: iconBg(file.mimeType) }}
            >
              <FileTypeIcon mimeType={file.mimeType} className="size-6" />
            </span>

            <div className="min-w-0 flex-1">
              {isRenaming ? (
                <input
                  type="text"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => onRenameChange(e.target.value)}
                  onBlur={() => onRenameSubmit(file.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onRenameSubmit(file.id);
                    if (e.key === 'Escape') onRenameCancel();
                  }}
                  className="card-title w-full bg-transparent pb-0.5 outline-none"
                  style={{
                    borderBottom: '1.5px solid var(--pw-accent)',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    fontFamily: 'var(--pw-font-display)',
                  }}
                  aria-label="Edit file name"
                />
              ) : (
                <h2
                  className="card-title cursor-text truncate"
                  title={file.displayName ?? file.fileName}
                  onClick={() => onRenameStart(file)}
                >
                  {file.displayName ?? file.fileName}
                </h2>
              )}

              {file.displayName && file.displayName !== file.fileName && (
                <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {file.fileName}
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <hr className="border-0 border-t" style={{ borderColor: 'var(--color-border-light)', margin: 0 }} />

          {/* Label */}
          <div className="flex flex-col gap-2">
            <p className="pw-eyebrow">Document type</p>
            <DocTypeCombobox
              fileId={file.id}
              value={file.documentType}
              disabled={pendingLabel === file.id}
              onChange={onLabelChange}
            />
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                Size
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {formatBytes(file.fileSize)}
              </p>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                Uploaded
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {formatDate(file.uploadedAt)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={viewingId === file.id}
              onClick={() => onView(file.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-btn)',
                background: viewingId === file.id ? 'rgba(26,86,219,0.6)' : 'var(--pw-accent)',
                color: '#fff', border: 'none',
                fontFamily: 'var(--pw-font-ui)', fontSize: 13, fontWeight: 500,
                cursor: viewingId === file.id ? 'not-allowed' : 'pointer',
                transition: 'background 150ms ease',
              }}
            >
              <Eye className="size-4" />
              {viewingId === file.id ? 'Opening…' : 'View'}
            </button>

            <button
              type="button"
              disabled={downloadingId === file.id}
              onClick={() => onDownload(file)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                flex: 1, padding: '9px 16px', borderRadius: 'var(--radius-btn)',
                background: '#fff', color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                fontFamily: 'var(--pw-font-ui)', fontSize: 13, fontWeight: 500,
                cursor: downloadingId === file.id ? 'not-allowed' : 'pointer',
                opacity: downloadingId === file.id ? 0.6 : 1,
                transition: 'background 150ms ease',
              }}
            >
              <Download className="size-4" />
              {downloadingId === file.id ? 'Saving…' : 'Download'}
            </button>

            <button
              type="button"
              onClick={() => onDelete(file.id)}
              className="inline-flex size-10 flex-shrink-0 items-center justify-center rounded-btn border transition-colors duration-150 hover:border-red-200 hover:bg-red-50"
              style={{
                borderColor: 'var(--color-border-light)',
                color: 'var(--color-text-tertiary)',
              }}
              aria-label="Delete file"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Document stack (teaser) ─────────────────────────────────────────────────────

interface DocumentStackProps {
  files: VaultFile[];
  onExpand: (file: VaultFile) => void;
}

const VAULT_STACK_MAX = 3;

// Positional CSS classes — each bakes translate + skewY(-8deg) into one transform declaration
// so the skew is never clobbered by Tailwind translate utilities (both write `transform`).
const STACK_POSITIONS: string[] = [
  'dc-vault-back',   // back
  'dc-vault-mid',    // middle
  'dc-vault-front',  // front
];

interface VaultCardProps {
  file: VaultFile;
  positionClass: string;
  isFront: boolean;
  onClick: () => void;
}

/** Single skewed card in the vault hover-stack. */
function VaultCard({ file, positionClass, isFront, onClick }: VaultCardProps) {
  return (
    <div
      className={`dc-stack dc-display-card relative flex h-36 w-72 cursor-pointer select-none flex-col justify-between overflow-hidden rounded-card border px-4 py-4 ${positionClass}`}
      style={{
        background: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border-light)',
        boxShadow: 'var(--shadow-card)',
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      aria-label={`Open ${file.displayName ?? file.fileName}`}
    >
      {/* Right-edge fade */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-px top-[-5%] h-[110%] w-32"
        style={{ background: 'linear-gradient(to left, var(--color-bg-base) 10%, transparent)' }}
      />

      {/* Icon + filename */}
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span
          className="inline-flex size-7 flex-shrink-0 items-center justify-center rounded-icon"
          style={{ background: 'rgba(26,86,219,0.07)' }}
        >
          {file.mimeType.startsWith('image/')
            ? <ImageIcon className="size-3.5" style={{ color: 'var(--pw-accent)' }} />
            : <FileText className="size-3.5" style={{ color: 'var(--pw-accent)' }} />
          }
        </span>
        <p
          className="truncate text-[13px] font-medium"
          style={{ color: 'var(--color-text-primary)' }}
          title={file.displayName ?? file.fileName}
        >
          {file.displayName ?? file.fileName}
        </p>
      </div>

      {/* Document type label */}
      <p className="truncate text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        {file.documentType
          ? (DOCUMENT_TYPE_LABEL[file.documentType] ?? file.documentType)
          : 'Not labelled yet'}
      </p>

      {/* Meta row + open affordance */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {formatBytes(file.fileSize)} · {formatDate(file.uploadedAt)}
        </p>
        {isFront && (
          <p
            className="flex-shrink-0 text-[10px] font-medium uppercase tracking-widest"
            style={{ color: 'var(--pw-accent)' }}
          >
            Open →
          </p>
        )}
      </div>
    </div>
  );
}

/** CSS hover fan-out stack — shows up to 3 most recent files as a visual teaser. */
function DocumentStack({ files, onExpand }: DocumentStackProps) {
  const visible = files.slice(0, VAULT_STACK_MAX);
  const count = visible.length;

  // Render back cards first so the front card layers on top via CSS stacking order.
  const renderOrder = [...visible].reverse();

  return (
    <div className="dc-grid" style={{ padding: '4px 168px 80px 4px' }}>
      {renderOrder.map((file, reversedIndex) => {
        const posIdx = (VAULT_STACK_MAX - count) + reversedIndex;
        const isFront = reversedIndex === count - 1;
        return (
          <VaultCard
            key={file.id}
            file={file}
            positionClass={STACK_POSITIONS[posIdx] ?? STACK_POSITIONS[2]}
            isFront={isFront}
            onClick={() => onExpand(file)}
          />
        );
      })}
    </div>
  );
}

// ── Document grid card ──────────────────────────────────────────────────────────

interface DocumentGridCardProps {
  file: VaultFile;
  onExpand: (file: VaultFile) => void;
}

/** Single card in the full document grid — clicking opens the expanded overlay. */
function DocumentGridCard({ file, onExpand }: DocumentGridCardProps) {
  return (
    <div
      className="card card-interactive flex flex-col gap-3"
      style={{ cursor: 'pointer', padding: '16px' }}
      onClick={() => onExpand(file)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onExpand(file); }}
      aria-label={`Open ${file.displayName ?? file.fileName}`}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex size-9 flex-shrink-0 items-center justify-center rounded-icon"
          style={{ background: iconBg(file.mimeType) }}
        >
          <FileTypeIcon mimeType={file.mimeType} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--pw-font-display)' }}
            title={file.displayName ?? file.fileName}
          >
            {file.displayName ?? file.fileName}
          </p>
          {file.documentType ? (
            <span
              className="mt-1.5 inline-block rounded-badge px-2 py-0.5 text-[11px]"
              style={{
                background: 'rgba(26,86,219,0.07)',
                color: 'var(--pw-accent)',
                border: '1px solid rgba(26,86,219,0.25)',
                fontFamily: 'var(--pw-font-body)',
              }}
            >
              {DOCUMENT_TYPE_LABEL[file.documentType] ?? file.documentType}
            </span>
          ) : (
            <span
              className="mt-1.5 inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px]"
              style={{
                background: 'rgba(26,86,219,0.05)',
                color: 'var(--pw-accent)',
                border: '1px dashed rgba(26,86,219,0.3)',
                fontFamily: 'var(--pw-font-body)',
              }}
            >
              Add label
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between pt-0.5">
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--pw-font-body)' }}>
          {formatBytes(file.fileSize)} · {formatDate(file.uploadedAt)}
        </p>
        <p
          className="text-[10px] font-medium uppercase tracking-widest"
          style={{ color: 'var(--pw-accent)' }}
        >
          Open →
        </p>
      </div>
    </div>
  );
}

// ── Requirements panel ──────────────────────────────────────────────────────────

interface RequirementsPanelProps {
  requirements: DocumentRequirement[];
  files: VaultFile[];
}

/** Sidebar checklist of pathway document requirements vs uploaded and labelled vault files. */
function RequirementsPanel({ requirements, files }: RequirementsPanelProps) {
  const uploadedTypes = new Set(
    files.map((f) => f.documentType).filter((t): t is string => t !== null)
  );

  const mandatory = requirements.filter((r) => r.isMandatory);
  const optional = requirements.filter((r) => !r.isMandatory);
  const satisfiedCount = mandatory.filter((r) => uploadedTypes.has(r.documentType)).length;

  return (
    <div>
      <p className="pw-eyebrow mb-2">Required documents</p>

      {requirements.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--pw-font-body)' }}>
          Select a pathway to see your document checklist.
        </p>
      ) : (
        <>
          <p
            className="mb-4 text-sm"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--pw-font-body)' }}
          >
            {satisfiedCount} of {mandatory.length} required uploaded
          </p>

          <div className="flex flex-col">
            {mandatory.map((req, i) => {
              const done = uploadedTypes.has(req.documentType);
              return (
                <div
                  key={req.id}
                  className="flex items-center gap-2.5 py-2.5"
                  style={i > 0 ? { borderTop: '1px solid var(--color-border-light)' } : undefined}
                >
                  <span
                    className="inline-flex size-4 flex-shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: done ? 'var(--pw-success)' : 'var(--color-bg-muted)',
                      fontSize: 9,
                      color: done ? '#fff' : 'var(--color-text-tertiary)',
                    }}
                  >
                    {done ? '✓' : ''}
                  </span>
                  <p
                    className="text-xs leading-snug"
                    style={{
                      color: done ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
                      fontFamily: 'var(--pw-font-body)',
                    }}
                  >
                    {req.name}
                  </p>
                </div>
              );
            })}

            {optional.length > 0 && (
              <>
                <p className="pw-eyebrow mt-5 mb-1">Optional</p>
                {optional.map((req, i) => {
                  const done = uploadedTypes.has(req.documentType);
                  return (
                    <div
                      key={req.id}
                      className="flex items-center gap-2.5 py-2.5"
                      style={i > 0 ? { borderTop: '1px solid var(--color-border-light)' } : undefined}
                    >
                      <span
                        className="inline-flex size-4 flex-shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: done ? 'var(--pw-success)' : 'var(--color-bg-muted)',
                          fontSize: 9,
                          color: done ? '#fff' : 'var(--color-text-tertiary)',
                        }}
                      >
                        {done ? '✓' : ''}
                      </span>
                      <p
                        className="text-xs leading-snug"
                        style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--pw-font-body)' }}
                      >
                        {req.name}
                      </p>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

/** General-purpose file vault — upload, label, rename, view, download, and manage immigration documents. */
export function DocumentsClient({ initialFiles, requirements }: DocumentsClientProps) {
  const [files, setFiles] = useState<VaultFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedFile, setExpandedFile] = useState<VaultFile | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = expandedFile ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [expandedFile]);

  function openExpanded(file: VaultFile) {
    setExpandedFile(file);
    setIsExiting(false);
  }

  function closeExpanded() {
    setIsExiting(true);
    setTimeout(() => {
      setExpandedFile(null);
      setIsExiting(false);
      setRenamingId(null);
    }, 220);
  }

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
      const updated = json.file;
      setFiles((prev) => prev.map((f) => (f.id === fileId ? (updated ?? f) : f)));
      if (expandedFile?.id === fileId && updated) setExpandedFile(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update label.');
    } finally {
      setPendingLabel(null);
    }
  }, [expandedFile]);

  const handleDelete = useCallback(async (fileId: string) => {
    setError(null);
    closeExpanded();
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
        const updated = json.file;
        setFiles((prev) => prev.map((f) => (f.id === fileId ? (updated ?? f) : f)));
        if (expandedFile?.id === fileId && updated) setExpandedFile(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename file.');
      }
    },
    [renameValue, expandedFile]
  );

  const atLimit = files.length >= MAX_FILES_PER_USER;

  return (
    <div className="flex flex-1 overflow-hidden relative z-10">

      {/* ── Main scrollable content ── */}
      <div className="flex-1 overflow-y-auto p-[28px]">

        {/* Header + error + dropzone */}
        <div className="mx-auto max-w-2xl">
          <div className="pw-entry mb-6 flex items-baseline justify-between">
            <p className="pw-eyebrow">Documents</p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {files.length} / {MAX_FILES_PER_USER} files
            </p>
          </div>

          {error && (
            <div
              className="pw-entry mb-4 rounded-card border px-4 py-3 text-sm"
              style={{
                background: 'rgba(220,38,38,0.05)',
                borderColor: 'rgba(220,38,38,0.18)',
                color: '#DC2626',
                fontFamily: 'var(--pw-font-body)',
              }}
            >
              {error}
            </div>
          )}

          {!atLimit && (
            <div
              className={`doc-upload-zone pw-entry mb-10 ${isDragging ? 'dragging' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={uploading ? undefined : () => fileInputRef.current?.click()}
              style={{ cursor: uploading ? 'default' : 'pointer', padding: '24px 20px' }}
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-3">
                  <span
                    className="inline-flex size-8 items-center justify-center rounded-icon"
                    style={{ background: 'var(--color-accent-50)' }}
                  >
                    <Upload className="size-4 animate-bounce" style={{ color: 'var(--color-accent-500)' }} />
                  </span>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Uploading…</p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <span
                    className="inline-flex size-8 flex-shrink-0 items-center justify-center rounded-icon"
                    style={{ background: isDragging ? 'var(--color-accent-100)' : 'var(--color-bg-subtle)' }}
                  >
                    <Upload
                      className="size-4"
                      style={{ color: isDragging ? 'var(--color-accent-600)' : 'var(--color-text-tertiary)' }}
                    />
                  </span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Drop a file or{' '}
                      <span style={{ color: 'var(--color-accent-600)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                        browse
                      </span>
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      PDF, JPEG, or PNG · Max 10 MB
                    </p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileInput}
                aria-label="Upload document"
              />
            </div>
          )}

          {atLimit && (
            <div
              className="pw-entry mb-8 rounded-card px-4 py-3 text-sm"
              style={{
                background: 'var(--color-bg-subtle)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--pw-font-body)',
              }}
            >
              Vault is full ({MAX_FILES_PER_USER} files). Delete a file to upload a new one.
            </div>
          )}
        </div>

        {/* Content area */}
        {files.length === 0 ? (
          <div className="mx-auto max-w-2xl">
            <div className="pw-entry flex flex-col items-center gap-8 pt-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Your vault is empty
                </p>
                <p className="max-w-xs text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  Upload your immigration documents above — they&apos;ll appear here, labelled and ready for any application.
                </p>
              </div>
              <div className="pb-12">
                <DisplayCards />
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">

            {/* Recently added teaser */}
            <div className="pw-entry mb-10">
              <p className="pw-eyebrow mb-4">Recently added</p>
              <div className="flex justify-center">
                <DocumentStack files={files} onExpand={openExpanded} />
              </div>
            </div>

            {/* Full document grid */}
            <div className="pw-entry">
              <p className="pw-eyebrow mb-4">All documents ({files.length})</p>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
              >
                {files.map((file) => (
                  <DocumentGridCard
                    key={file.id}
                    file={file}
                    onExpand={openExpanded}
                  />
                ))}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ── Requirements sidebar — full height, pinned right ── */}
      <div
        className="w-72 flex-shrink-0 overflow-y-auto"
        style={{ borderLeft: '1px solid var(--color-border-light)' }}
      >
        <div style={{ padding: '28px 20px' }}>
          <RequirementsPanel requirements={requirements} files={files} />
        </div>
      </div>

      {/* Expanded card overlay */}
      {expandedFile && (
        <ExpandedCard
          file={expandedFile}
          isExiting={isExiting}
          pendingLabel={pendingLabel}
          viewingId={viewingId}
          downloadingId={downloadingId}
          renamingId={renamingId}
          renameValue={renameValue}
          onClose={closeExpanded}
          onLabelChange={handleLabelChange}
          onView={(id) => void handleView(id)}
          onDownload={(f) => void handleDownload(f)}
          onDelete={(id) => void handleDelete(id)}
          onRenameStart={handleRenameStart}
          onRenameChange={setRenameValue}
          onRenameSubmit={(id) => void handleRenameSubmit(id)}
          onRenameCancel={() => setRenamingId(null)}
        />
      )}
    </div>
  );
}
