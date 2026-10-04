import type { RoomState } from './types';

/**
 * Stable stringify: recursively sorted keys; arrays keep order; no undefined.
 *
 * Builds a sorted-key copy and lets the engine's native `JSON.stringify` do
 * the writing (far faster than any JS-level serializer). The copy uses
 * ordinary fast-mode objects — never `Object.create(null)` dictionaries — and
 * only falls back to `defineProperty` for a literal `__proto__` key.
 */
export function canonicalRoomJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const n = value.length;
    const out = new Array<unknown>(n);
    for (let i = 0; i < n; i++) out[i] = sortValue(value[i]);
    return out;
  }
  return sortRecord(value as Record<string, unknown>);
}

function sortRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const v = obj[key];
    if (v === undefined) continue;
    if (key === '__proto__') {
      // Copy as data, not as [[Prototype]].
      Object.defineProperty(out, key, {
        value: sortValue(v),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else {
      out[key] = sortValue(v);
    }
  }
  return out;
}

const FNV_OFFSET_HI = 0xcbf29ce4;
const FNV_OFFSET_LO = 0x84222325;
/** FNV-1a 64-bit prime = 2^40 + 0x1b3; low limb is 0x1b3, bit 40 handled via `lo << 8`. */
const FNV_PRIME_LO = 0x1b3;
const TWO_POW_32 = 0x100000000;

/**
 * FNV-1a 64-bit hex digest of JS string code units (UTF-16; pure; no crypto / Io).
 *
 * Implemented on two 32-bit limbs with `Math.imul` instead of `BigInt` — same
 * digest, several times faster on V8 / JSC.
 */
export function fnv1a64Hex(text: string): string {
  let hi = FNV_OFFSET_HI;
  let lo = FNV_OFFSET_LO;
  for (let i = 0; i < text.length; i++) {
    lo = (lo ^ text.charCodeAt(i)) >>> 0;
    // (hi·2^32 + lo) · (2^40 + 0x1b3) mod 2^64
    //   = lo·0x1b3 + (hi·0x1b3 + lo·2^8)·2^32   (hi·2^40·2^32 vanishes)
    const loProd = lo * FNV_PRIME_LO; // < 2^41, exact in a double
    const carry = Math.floor(loProd / TWO_POW_32);
    const nextLo = loProd >>> 0;
    hi =
      (carry + (Math.imul(hi, FNV_PRIME_LO) >>> 0) + ((lo << 8) >>> 0)) >>> 0;
    lo = nextLo;
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
}

/**
 * Canonical hash of room attribute state for reconnect / replay / anti-cheat.
 * Uses sorted-key JSON so equivalent states constructed in different key
 * orders produce the same digest.
 */
export function hashRoomState(state: RoomState): string {
  return fnv1a64Hex(canonicalRoomJson(state));
}
