import type { RoomState } from './types';

/** Stable stringify: recursively sorted keys; arrays keep order; no undefined. */
export function canonicalRoomJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortValue);
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const v = obj[key];
    if (v !== undefined) out[key] = sortValue(v);
  }
  return out;
}

/** FNV-1a 64-bit hex digest of UTF-8 text (pure; no crypto / Io). */
export function fnv1a64Hex(text: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

/**
 * Canonical hash of room attribute state for reconnect / replay / anti-cheat.
 * Uses sorted-key JSON so equivalent states constructed in different key
 * orders produce the same digest.
 */
export function hashRoomState(state: RoomState): string {
  return fnv1a64Hex(canonicalRoomJson(state));
}
