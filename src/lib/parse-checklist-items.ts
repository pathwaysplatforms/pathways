import type { ChecklistItem, ChecklistAiAction, AiActionType } from '@/modules/dashboard/types';

const AI_ACTION_TYPES = new Set<AiActionType>([
  'employer_reference_email',
  'eca_inquiry_email',
  'eca_status_email',
  'language_score_email',
  'bank_letter_request_email',
  'cover_letter',
  'employer_support_email',
  'pnp_inquiry_email',
  'trade_cert_inquiry_email',
  'transcript_request_email',
  'designated_org_inquiry_email',
  'commitment_letter_follow_up',
  'community_recommendation_request',
  'sponsorship_support_letter',
  'endorsement_inquiry_email',
]);

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
      const inputField = o.input_field && typeof o.input_field === 'object' && !Array.isArray(o.input_field)
        ? (() => {
            const f = o.input_field as Record<string, unknown>;
            if (typeof f.label !== 'string' || typeof f.placeholder !== 'string' || typeof f.key !== 'string') return undefined;
            return {
              label: f.label,
              placeholder: f.placeholder,
              key: f.key,
              hint: typeof f.hint === 'string' ? f.hint : undefined,
              type: f.type === 'number' ? 'number' as const : 'text' as const,
            };
          })()
        : undefined;

      const aiAction: ChecklistAiAction | undefined = (() => {
        if (!o.ai_action || typeof o.ai_action !== 'object' || Array.isArray(o.ai_action)) return undefined;
        const a = o.ai_action as Record<string, unknown>;
        if (
          typeof a.type !== 'string' || !AI_ACTION_TYPES.has(a.type as AiActionType) ||
          typeof a.button_label !== 'string' || typeof a.modal_title !== 'string'
        ) return undefined;
        return { type: a.type as AiActionType, button_label: a.button_label, modal_title: a.modal_title };
      })();

      return {
        label: typeof o.label === 'string' ? o.label : '',
        detail: typeof o.detail === 'string' ? o.detail : '',
        links: Array.isArray(o.links) ? (o.links as { label: string; url: string }[]) : undefined,
        tips: Array.isArray(o.tips) ? (o.tips as string[]) : undefined,
        input_field: inputField,
        ai_action: aiAction,
      } satisfies ChecklistItem;
    }
    return { label: String(item), detail: String(item) };
  });
}
