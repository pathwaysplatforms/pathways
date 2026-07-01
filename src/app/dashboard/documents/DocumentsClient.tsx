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

function formatRelativeDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
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

function docTypeBadge(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/png') return 'PNG';
  if (mimeType === 'image/jpeg') return 'JPG';
  return 'FILE';
}

// ── Grouping ─────────────────────────────────────────────────────────────────────

type VaultGroup = 'Identity' | 'Language' | 'Financial' | 'Work' | 'Other';

const GROUP_ORDER: readonly VaultGroup[] = ['Identity', 'Language', 'Financial', 'Work', 'Other'];

const TYPE_TO_GROUP: Partial<Record<string, VaultGroup>> = {
  // Identity
  passport:               'Identity',
  identity_document:      'Identity',
  birth_certificate:      'Identity',
  photo:                  'Identity',
  marriage_certificate:   'Identity',
  police_certificate:     'Identity',
  residency_proof:        'Identity',
  separation_declaration: 'Identity',
  statutory_declaration:  'Identity',
  // Language
  language_test:         'Language',
  english_language_test: 'Language',
  // Financial
  bank_statement: 'Financial',
  financial_form: 'Financial',
  fee_receipt:    'Financial',
  undertaking:    'Financial',
  // Work
  employment_letter:          'Work',
  employment_reference:       'Work',
  job_offer_letter:           'Work',
  cv:                         'Work',
  certificate_of_sponsorship: 'Work',
  nomination_letter:          'Work',
  provincial_nomination_letter: 'Work',
  endorsement_letter:         'Work',
  letter_of_support:          'Work',
  evidence_portfolio:         'Work',
  credential_certificate:     'Work',
  settlement_plan:            'Work',
  authorization_letter:       'Work',
  authorization_form:         'Work',
  representative_form:        'Work',
};

function getGroup(documentType: string | null): VaultGroup {
  if (!documentType) return 'Other';
  return TYPE_TO_GROUP[documentType] ?? 'Other';
}

function buildGroups(files: VaultFile[]): { group: VaultGroup; items: VaultFile[] }[] {
  const map = new Map<VaultGroup, VaultFile[]>();
  for (const f of files) {
    const g = getGroup(f.documentType);
    const arr = map.get(g) ?? [];
    arr.push(f);
    map.set(g, arr);
  }
  return GROUP_ORDER
    .filter(g => map.has(g))
    .map(g => ({ group: g, items: map.get(g) ?? [] }));
}

// ── Combobox ─────────────────────────────────────────────────────────────────────

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

// ── Expanded card overlay ─────────────────────────────────────────────────────────

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
            maxWidth: 500,
            minHeight: 520,
            background: 'var(--color-bg-surface)',
            boxShadow: 'var(--shadow-card-lg)',
            border: '1px solid var(--color-border-light)',
            padding: '32px',
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

// ── Document stack (teaser) ───────────────────────────────────────────────────────

interface DocumentStackProps {
  files: VaultFile[];
  onExpand: (file: VaultFile) => void;
}

const VAULT_STACK_MAX = 3;

const STACK_POSITIONS: string[] = [
  'dc-vault-back',
  'dc-vault-mid',
  'dc-vault-front',
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
      <span
        aria-hidden
        className="pointer-events-none absolute -right-px top-[-5%] h-[110%] w-32"
        style={{ background: 'linear-gradient(to left, var(--color-bg-base) 10%, transparent)' }}
      />

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

      <p className="truncate text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        {file.documentType
          ? (DOCUMENT_TYPE_LABEL[file.documentType] ?? file.documentType)
          : 'Not labelled yet'}
      </p>

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

// ── Image thumbnail ───────────────────────────────────────────────────────────────

/** Fetches a signed URL and renders a native img preview for image vault files. */
function ImageThumbnail({ fileId }: { fileId: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/vault/signed-url/${fileId}`)
      .then(r => r.json())
      .then(data => {
        const json = data as { url?: string };
        if (!cancelled && json.url) setSrc(json.url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fileId]);

  if (!src) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ImageIcon className="size-6" style={{ color: 'var(--color-text-tertiary)', opacity: 0.35 }} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
}

// ── Document icon card ────────────────────────────────────────────────────────────

interface DocumentGridCardProps {
  file: VaultFile;
  onExpand: (file: VaultFile) => void;
}

/** Vault grid card — image preview or neutral file-type icon, no skeleton lines or colour banners. */
function DocumentIconCard({ file, onExpand }: DocumentGridCardProps) {
  const [hovered, setHovered] = useState(false);
  const isImage = file.mimeType.startsWith('image/');
  const displayName = file.displayName ?? file.fileName;
  const badge = docTypeBadge(file.mimeType);
  const nameWithoutExt = displayName.replace(/\.[^.]+$/, '');
  const label = nameWithoutExt.length > 22 ? nameWithoutExt.slice(0, 20) + '…' : nameWithoutExt;

  return (
    <button
      type="button"
      onClick={() => onExpand(file)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Open ${displayName}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        border: hovered ? '1.5px solid var(--color-border)' : '1.5px solid var(--color-border-light)',
        background: 'var(--color-bg-surface)',
        cursor: 'pointer',
        borderRadius: 8,
        width: '100%',
        transition: 'border-color 150ms cubic-bezier(0.16,1,0.3,1), box-shadow 150ms cubic-bezier(0.16,1,0.3,1)',
        boxShadow: hovered ? 'var(--shadow-card)' : '0 1px 2px rgba(0,0,0,0.04)',
        textAlign: 'left',
        fontFamily: 'var(--pw-font-body)',
        overflow: 'hidden',
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          position: 'relative',
          height: 140,
          overflow: 'hidden',
          flexShrink: 0,
          background: 'var(--color-bg-subtle)',
        }}
      >
        {isImage ? (
          <ImageThumbnail fileId={file.id} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileText
              className="size-10"
              style={{ color: 'var(--color-text-tertiary)', opacity: 0.4 }}
            />
          </div>
        )}

        {/* Neutral file-type tag */}
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            padding: '2px 7px',
            borderRadius: 9999,
            background: 'rgba(26,86,219,0.10)',
            color: 'var(--pw-accent)',
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.07em',
            fontFamily: 'var(--pw-font-body)',
          }}
        >
          {badge}
        </span>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '10px 12px 11px',
          borderTop: '1px solid var(--color-border-light)',
          background: 'var(--color-bg-surface)',
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--pw-font-body)',
            lineHeight: 1.35,
            margin: 0,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: 10,
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--pw-font-body)',
            lineHeight: 1.3,
            margin: '2px 0 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {formatRelativeDate(file.uploadedAt)} · {formatBytes(file.fileSize)}
        </p>
      </div>
    </button>
  );
}

// ── Ghost placeholder cards ───────────────────────────────────────────────────────

const PLACEHOLDER_CARDS: readonly { label: string; badge: string }[] = [
  { label: 'Passport',             badge: 'PDF' },
  { label: 'IELTS Results',        badge: 'PDF' },
  { label: 'Bank Statement',       badge: 'PDF' },
  { label: 'University Transcript', badge: 'PDF' },
  { label: 'Employment Letter',    badge: 'PDF' },
  { label: 'Photo ID',             badge: 'JPG' },
];

/** Ghost placeholder card matching DocumentIconCard — shown when vault is empty. */
function PlaceholderDocumentCard({ label, badge }: { label: string; badge: string }) {
  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        border: '1.5px solid var(--color-border-light)',
        background: 'var(--color-bg-surface)',
        borderRadius: 8,
        width: '100%',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        opacity: 0.35,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 140,
          background: 'var(--color-bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FileText
          className="size-10"
          style={{ color: 'var(--color-text-tertiary)', opacity: 0.3 }}
        />
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            padding: '2px 7px',
            borderRadius: 9999,
            background: 'rgba(26,86,219,0.08)',
            color: 'var(--pw-accent)',
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.07em',
            fontFamily: 'var(--pw-font-body)',
          }}
        >
          {badge}
        </span>
      </div>
      <div
        style={{
          padding: '10px 12px 11px',
          borderTop: '1px solid var(--color-border-light)',
          background: 'var(--color-bg-surface)',
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--pw-font-body)',
            lineHeight: 1.35,
            margin: 0,
            fontWeight: 500,
          }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────────

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
  const [expandedFile, setExpandedFile] = useState<VaultFile | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const groups = buildGroups(files);

  return (
    <div className="relative z-10 flex flex-1 overflow-hidden">

      {/* Scrollable column */}
      <div className="flex-1 overflow-y-auto p-[28px]">
        <div className="mx-auto w-full max-w-3xl">

          {/* Header */}
          <div className="pw-entry mb-6">
            <p
              className="text-xl"
              style={{
                fontFamily: 'var(--pw-font-display)',
                color: 'var(--color-text-primary)',
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              Documents
            </p>
            <p
              className="text-sm"
              style={{ fontFamily: 'var(--pw-font-body)', color: 'var(--color-text-secondary)' }}
            >
              Everything you upload lives here, organized for you.
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

          {/* Dropzone */}
          {!atLimit && (
            <div
              className={`doc-upload-zone pw-entry mb-10 ${isDragging ? 'dragging' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={uploading ? undefined : () => fileInputRef.current?.click()}
              style={{ cursor: uploading ? 'default' : 'pointer' }}
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-3">
                  <span
                    className="inline-flex size-8 items-center justify-center rounded-icon"
                    style={{ background: 'rgba(26,86,219,0.06)' }}
                  >
                    <Upload className="size-4 animate-bounce" style={{ color: 'var(--pw-accent)' }} />
                  </span>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Uploading…</p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <span
                    className="inline-flex size-8 flex-shrink-0 items-center justify-center rounded-icon"
                    style={{
                      background: isDragging ? 'rgba(26,86,219,0.10)' : 'var(--color-bg-subtle)',
                    }}
                  >
                    <Upload
                      className="size-4"
                      style={{ color: isDragging ? 'var(--pw-accent)' : 'var(--color-text-tertiary)' }}
                    />
                  </span>
                  <div>
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: 'var(--pw-font-body)',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 2,
                      }}
                    >
                      Add a document to your vault
                    </p>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Drop a file or{' '}
                      <span
                        style={{
                          color: 'var(--pw-accent)',
                          textDecoration: 'underline',
                          textUnderlineOffset: 2,
                        }}
                      >
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
              Your vault is full — delete a file to make room.
            </div>
          )}

          {/* Document grid */}
          <div className="pw-entry">
            {files.length === 0 ? (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
              >
                {PLACEHOLDER_CARDS.map(card => (
                  <PlaceholderDocumentCard key={card.label} label={card.label} badge={card.badge} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {groups.map(({ group, items }) => (
                  <div key={group}>
                    <p className="pw-eyebrow mb-3">{group}</p>
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
                    >
                      {items.map(file => (
                        <DocumentIconCard key={file.id} file={file} onExpand={openExpanded} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
