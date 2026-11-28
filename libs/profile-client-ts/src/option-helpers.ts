import type { SchemaField } from '@libs/profile-shared-ts/dicebear-schema';
import {
  getDefaultOptionsFromSchema,
  getFieldsForStyle,
} from '@libs/profile-shared-ts/dicebear-schema';
import type { StyleKey } from '@libs/profile-shared-ts/dicebear-styles';

export function buildThumbnailEnumOptions(
  styleKey: StyleKey,
  fieldKey: string,
  variant: string | null,
  baseOptions: Record<string, unknown>
): Record<string, unknown> {
  const fields = getFieldsForStyle(styleKey);
  const field = fields.find((f) => f.kind === 'enum' && f.key === fieldKey);
  const defaults = getDefaultOptionsFromSchema(styleKey);
  const merged = { ...defaults, ...baseOptions };
  if (!field || field.kind !== 'enum') {
    return merged;
  }
  if (variant === null) {
    const next = { ...merged };
    delete next[fieldKey];
    return next;
  }
  return { ...merged, [fieldKey]: [variant] };
}

export function humanizeOptionKey(key: string): string {
  const spaced = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/Probability$/i, ' probability');
  return spaced
    .split(' ')
    .map((w) =>
      w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(' ');
}

/** A single explicit choice, unless it is the style's entire default pool. */
export function selectedVariantForField(
  field: Extract<SchemaField, { kind: 'enum' }>,
  current: unknown
): string | null {
  if (!Array.isArray(current) || current.length !== 1) return null;
  const variant: unknown = current[0];
  if (typeof variant !== 'string') return null;
  return field.default.length === 1 && field.default[0] === variant
    ? null
    : variant;
}
