/**
 * Field readers for `parse`: each reads one field of a YAML mapping, and
 * either returns its value or adds a precise issue (`<where>: <field> …`)
 * and returns `null`. Nothing here throws.
 */

import { parseDuration } from './window';

export type Mapping = Readonly<Record<string, unknown>>;

/** Where a reader is (`SLO note-delivery`) and the issues found so far. */
export type Cursor = {
  readonly where: string;
  readonly issues: string[];
};

export const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isMapping(value: unknown): value is Mapping {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function report(at: Cursor, message: string): null {
  at.issues.push(`${at.where}: ${message}`);
  return null;
}

export function readMapping(
  at: Cursor,
  from: Mapping,
  field: string
): Mapping | null {
  const value = from[field];
  if (value === undefined) return report(at, `${field} is missing`);
  if (!isMapping(value)) return report(at, `${field} must be a mapping`);
  return value;
}

export function readString(
  at: Cursor,
  from: Mapping,
  field: string
): string | null {
  const value = from[field];
  if (value === undefined) return report(at, `${field} is missing`);
  if (typeof value !== 'string' || value.trim().length === 0) {
    return report(at, `${field} must be a non-empty string`);
  }
  return value;
}

/** An optional string: `null` when absent, an issue when not a string. */
export function readOptionalString(
  at: Cursor,
  from: Mapping,
  field: string
): string | null {
  if (from[field] === undefined) return null;
  return readString(at, from, field);
}

export function readBoolean(
  at: Cursor,
  from: Mapping,
  field: string
): boolean | null {
  const value = from[field];
  if (value === undefined) return report(at, `${field} is missing`);
  if (typeof value !== 'boolean') {
    return report(at, `${field} must be true or false`);
  }
  return value;
}

/** A number in `(min, max]`, or `null` (with an issue) otherwise. */
export function readFraction(
  at: Cursor,
  input: {
    readonly from: Mapping;
    readonly field: string;
    readonly max: number;
  }
): number | null {
  const value = input.from[input.field];
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > input.max
  ) {
    return report(
      at,
      `${input.field} must be a number in (0, ${String(input.max)}], got ${JSON.stringify(value) ?? 'nothing'}`
    );
  }
  return value;
}

export function readOneOf<T extends string>(
  at: Cursor,
  input: {
    readonly from: Mapping;
    readonly field: string;
    readonly allowed: readonly T[];
  }
): T | null {
  const value = input.from[input.field];
  if (
    typeof value === 'string' &&
    (input.allowed as readonly string[]).includes(value)
  ) {
    return value as T;
  }
  return report(
    at,
    `${input.field} must be one of ${input.allowed.join(', ')}, got ${JSON.stringify(value) ?? 'nothing'}`
  );
}

/** `metadata.name` (kebab-case) and the optional `metadata.displayName`. */
export function readMetadata(
  at: Cursor,
  from: Mapping
): { readonly name: string; readonly displayName: string | null } | null {
  const metadata = readMapping(at, from, 'metadata');
  if (metadata === null) return null;
  const name = readString(at, metadata, 'name');
  const displayName = readOptionalString(at, metadata, 'displayName');
  if (name === null) return null;
  if (!KEBAB_CASE.test(name)) {
    return report(at, `metadata.name "${name}" must be kebab-case`);
  }
  if (name.length > 63) {
    return report(at, `metadata.name "${name}" must be at most 63 characters`);
  }
  if (displayName !== null && displayName.length > 63) {
    return report(
      at,
      `metadata.displayName "${displayName}" must be at most 63 characters (OpenSLO)`
    );
  }
  return { name, displayName };
}

export function readDuration(
  at: Cursor,
  from: Mapping,
  field: string
): string | null {
  const text = readString(at, from, field);
  if (text === null) return null;
  if (parseDuration(text) === null) {
    return report(
      at,
      `${field} "${text}" must be a positive whole number of s, m, h, d or w (28d)`
    );
  }
  return text;
}
