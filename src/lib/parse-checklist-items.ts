import type { ChecklistItem } from '@/modules/dashboard/types';

/**
 * Normalise raw JSONB checklist_items to ChecklistItem[].
 * Handles legacy plain-string arrays and the current rich-object format.
 * Returns null when the value is absent or empty.
 */
export function parseChecklistItems(raw: unknown): ChecklistItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((item) => {
    if (typeof item === 'string') return { label: item, detail: item };
    if (item !== null && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      return {
        label: typeof o.label === 'string' ? o.label : '',
        detail: typeof o.detail === 'string' ? o.detail : '',
        links: Array.isArray(o.links) ? (o.links as { label: string; url: string }[]) : undefined,
        tips: Array.isArray(o.tips) ? (o.tips as string[]) : undefined,
      } satisfies ChecklistItem;
    }
    return { label: String(item), detail: String(item) };
  });
}
