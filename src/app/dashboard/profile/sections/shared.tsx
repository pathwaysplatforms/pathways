'use client';

import type { ProfileUpdateFields } from '@/app/actions/profile';
import type { ProfileTabData } from '@/modules/profile/types';
import { EDUCATION_OPTIONS, NOC_TEER_OPTIONS, BOOLEAN_OPTIONS } from '@/modules/voice/types';

export { EDUCATION_OPTIONS, NOC_TEER_OPTIONS, BOOLEAN_OPTIONS };

// ─── Types ────────────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SectionSavePayload {
  fields: ProfileUpdateFields;
  recalculate?: boolean;
}

export interface SectionProps {
  data: ProfileTabData;
  onSave: (payload: SectionSavePayload) => Promise<void>;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function displayValue(v: string | number | boolean | null | undefined): React.ReactNode {
  if (v === null || v === undefined || v === '') {
    return <span style={{ color: '#9B9B9B', fontFamily: 'var(--pw-font-body)', fontSize: 14 }}>—</span>;
  }
  if (typeof v === 'boolean') {
    return <span style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#0D0D0D' }}>{v ? 'Yes' : 'No'}</span>;
  }
  return <span style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#0D0D0D' }}>{String(v)}</span>;
}

export function displayEnum(
  value: string | null,
  options: readonly { value: string; label: string }[]
): React.ReactNode {
  const match = options.find((o) => o.value === value);
  return displayValue(match ? match.label : value);
}

export function displayBool(value: boolean | null): React.ReactNode {
  if (value === null) {
    return <span style={{ color: '#9B9B9B', fontFamily: 'var(--pw-font-body)', fontSize: 14 }}>—</span>;
  }
  return <span style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#0D0D0D' }}>{value ? 'Yes' : 'No'}</span>;
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  readContent: React.ReactNode;
  editContent?: React.ReactNode;
  isEditing: boolean;
  isLast?: boolean;
}

export function FieldRow({ label, readContent, editContent, isEditing, isLast = false }: FieldRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '8px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.05)',
        minHeight: 38,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 12,
          color: '#9B9B9B',
          flexShrink: 0,
          minWidth: 148,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {isEditing && editContent ? editContent : readContent}
      </div>
    </div>
  );
}

// ─── Form controls ────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%',
  maxWidth: 220,
  border: 'none',
  borderBottom: '1px solid rgba(0,0,0,0.2)',
  borderRadius: 0,
  background: 'transparent',
  fontFamily: 'var(--pw-font-body)',
  fontSize: 14,
  color: '#0D0D0D',
  padding: '2px 0 4px',
  outline: 'none',
  textAlign: 'right',
  transition: 'border-color 150ms ease',
};

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function TextInput({ value, onChange, placeholder }: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={(e) => { (e.target as HTMLInputElement).style.borderBottomColor = '#0D0D0D'; }}
      onBlur={(e) => { (e.target as HTMLInputElement).style.borderBottomColor = 'rgba(0,0,0,0.2)'; }}
      style={inputBase}
    />
  );
}

interface NumberInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
}

export function NumberInput({ value, onChange, min, max }: NumberInputProps) {
  return (
    <input
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') { onChange(null); return; }
        const n = parseFloat(raw);
        onChange(Number.isNaN(n) ? null : n);
      }}
      onFocus={(e) => { (e.target as HTMLInputElement).style.borderBottomColor = '#0D0D0D'; }}
      onBlur={(e) => { (e.target as HTMLInputElement).style.borderBottomColor = 'rgba(0,0,0,0.2)'; }}
      style={{ ...inputBase, maxWidth: 100 }}
    />
  );
}

interface SelectInputProps {
  value: string | null;
  onChange: (v: string | null) => void;
  options: readonly { value: string; label: string }[];
}

export function SelectInput({ value, onChange, options }: SelectInputProps) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? null : v);
      }}
      style={{
        ...inputBase,
        cursor: 'pointer',
        appearance: 'none',
        paddingRight: 16,
        maxWidth: 220,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

interface BooleanSelectProps {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}

export function BooleanSelect({ value, onChange }: BooleanSelectProps) {
  const current = value === null ? '' : String(value);
  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '') onChange(null);
        else onChange(v === 'true');
      }}
      style={{
        ...inputBase,
        cursor: 'pointer',
        appearance: 'none',
        paddingRight: 16,
        maxWidth: 160,
      }}
    >
      {BOOLEAN_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  isEditing: boolean;
  isSaving: boolean;
  saveError: string | null;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

export function SectionCard({
  title,
  isEditing,
  isSaving,
  saveError,
  onEdit,
  onSave,
  onCancel,
  children,
}: SectionCardProps) {
  return (
    <div className="pw-card pw-entry">
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="pw-eyebrow">{title}</p>
        {!isEditing && (
          <button
            type="button"
            onClick={onEdit}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#0D0D0D'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#9B9B9B'; }}
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: 'var(--pw-font-ui)',
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#9B9B9B',
              cursor: 'pointer',
              padding: 0,
              transition: 'color 150ms ease',
            }}
          >
            Edit
          </button>
        )}
      </div>

      {/* Hairline rule */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', marginBottom: 4 }} />

      {/* Section rows */}
      {children}

      {/* Save / Cancel — expands when editing */}
      <div className={`pw-section-actions${isEditing ? ' is-open' : ''}`}>
        <div style={{ paddingTop: 14 }}>
          {saveError && (
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, color: 'var(--pw-error)', marginBottom: 10 }}>
              {saveError}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '10px 20px',
                fontFamily: 'var(--pw-font-ui)',
                fontSize: 14,
                fontWeight: 500,
                color: '#fff',
                background: isSaving ? 'rgba(0,0,0,0.3)' : '#0D0D0D',
                border: 'none',
                borderRadius: 8,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                transition: 'background 150ms ease',
              }}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: 'var(--pw-font-ui)',
                fontSize: 12,
                color: '#9B9B9B',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                padding: 0,
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#0D0D0D'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#9B9B9B'; }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
