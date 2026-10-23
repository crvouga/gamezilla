import {
  KEYWORD_MAX_LENGTH,
  KEYWORD_NAMESPACE_MAX_SEGMENTS,
  KEYWORD_SEGMENT_MAX_LENGTH,
  KEYWORD_SEGMENT_MIN_LENGTH,
} from '@pkgs/keyword-shared-ts/keyword';

/**
 * Reference model of the keyword wire rules, written as a character walk so
 * it shares no regex with the implementation it checks.
 */
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

function isAlnum(char: string): boolean {
  return LOWER.includes(char) || DIGITS.includes(char);
}

export function modelSegment(seg: string): boolean {
  if (seg.length < KEYWORD_SEGMENT_MIN_LENGTH) return false;
  if (seg.length > KEYWORD_SEGMENT_MAX_LENGTH) return false;
  if (!LOWER.includes(seg[0] ?? '')) return false;
  let previous = '';
  for (const char of seg) {
    if (char === '-' && previous === '-') return false;
    if (char !== '-' && !isAlnum(char)) return false;
    previous = char;
  }
  return previous !== '-';
}

export function modelNamespace(prefix: string): boolean {
  const segments = prefix.split('.');
  if (segments.length > KEYWORD_NAMESPACE_MAX_SEGMENTS) return false;
  return segments.every(modelSegment);
}

export function modelKeyword(key: string): boolean {
  if (key.length > KEYWORD_MAX_LENGTH) return false;
  const parts = key.split('/');
  if (parts.length !== 2) return false;
  const [ns, local] = parts as [string, string];
  return modelNamespace(ns) && modelSegment(local);
}

/** The substring before the only `/`, or null (no slash, several, or at 0). */
export function modelPrefixOf(key: string): string | null {
  const parts = key.split('/');
  if (parts.length !== 2) return null;
  const ns = parts[0] as string;
  return ns.length === 0 ? null : ns;
}
