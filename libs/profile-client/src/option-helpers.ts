import type { SchemaField } from '@libs/profile-shared/dicebear-schema';
import {
  getDefaultOptionsFromSchema,
  getFieldsForStyle,
} from '@libs/profile-shared/dicebear-schema';
import type { StyleKey } from '@libs/profile-shared/dicebear-styles';

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

export function arraysEqualAsSets(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function getEnumSelectionMode(
  field: Extract<SchemaField, { kind: 'enum' }>,
  value: unknown
): 'random' | string {
  if (value === undefined) return 'random';
  if (!Array.isArray(value)) return 'random';
  if (value.length !== 1 || typeof value[0] !== 'string') {
    if (arraysEqualAsSets(value as string[], field.default)) return 'random';
    return 'random';
  }
  return value[0];
}

/** True if value matches schema default (full random pool). */
export function isEnumRandom(
  field: Extract<SchemaField, { kind: 'enum' }>,
  value: unknown
): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return true;
  return arraysEqualAsSets(value as string[], field.default);
}

/** Derive selectedVariant for a field from draft options. */
export function selectedVariantForField(
  field: Extract<SchemaField, { kind: 'enum' }>,
  current: unknown
): string | null {
  if (isEnumRandom(field, current)) return null;
  if (
    Array.isArray(current) &&
    current.length === 1 &&
    typeof current[0] === 'string'
  ) {
    return current[0];
  }
  return null;
}

export function getProbabilityMode(
  value: unknown
): 'off' | 'random' | 'always' {
  if (value === undefined) return 'random';
  if (typeof value !== 'number') return 'random';
  if (value === 0) return 'off';
  if (value === 100) return 'always';
  return 'random';
}
