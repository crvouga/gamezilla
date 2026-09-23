/**
 * Webhook signatures: `t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "t.body")>`
 * — Stripe's scheme under the mock's own header. Pure and synchronous, so the
 * provider signs and the adapter verifies on any runtime.
 */
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { MOCK_BILLING_SIGNATURE_TOLERANCE_S } from './wire';

function digest(secret: string, timestampS: number, payload: string): string {
  return bytesToHex(
    hmac(
      sha256,
      utf8ToBytes(secret),
      utf8ToBytes(`${String(timestampS)}.${payload}`)
    )
  );
}

/** Constant-time for equal lengths, so a mismatch leaks nothing positional. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export function signMockBillingPayload(args: {
  readonly secret: string;
  readonly payload: string;
  readonly timestampS: number;
}): string {
  return `t=${String(args.timestampS)},v1=${digest(args.secret, args.timestampS, args.payload)}`;
}

function parseHeader(
  header: string
): { readonly t: number; readonly v1: readonly string[] } | null {
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2);
    if (key === 't' && value !== undefined && /^\d+$/.test(value)) {
      t = Number(value);
    }
    if (key === 'v1' && value !== undefined) v1.push(value);
  }
  return t === null || v1.length === 0 ? null : { t, v1 };
}

/**
 * True when some `v1` in `header` signs `payload` with `secret` and its
 * timestamp is within the tolerance of `nowMs`. Several `v1`s are allowed so a
 * secret can roll without dropping deliveries.
 */
export function verifyMockBillingSignature(args: {
  readonly secret: string;
  readonly payload: string;
  readonly header: string;
  readonly nowMs: number;
}): boolean {
  const parsed = parseHeader(args.header);
  if (parsed === null) return false;
  const ageS = Math.floor(args.nowMs / 1000) - parsed.t;
  if (Math.abs(ageS) > MOCK_BILLING_SIGNATURE_TOLERANCE_S) return false;
  const expected = digest(args.secret, parsed.t, args.payload);
  return parsed.v1.some((candidate) => sameHex(candidate, expected));
}
