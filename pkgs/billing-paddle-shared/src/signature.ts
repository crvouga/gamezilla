/**
 * Paddle webhook signatures: `Paddle-Signature: ts=<unix s>;h1=<hex>`, where
 * `h1` is HMAC-SHA256 over `"<ts>:<raw body>"` keyed by the notification
 * destination's endpoint secret. Several `h1`s may appear while a secret
 * rotates. Pure and synchronous, so it runs on any runtime and under a
 * virtual clock.
 */
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { PADDLE_SIGNATURE_TOLERANCE_S } from './wire';

function digest(secret: string, timestampS: number, payload: string): string {
  return bytesToHex(
    hmac(
      sha256,
      utf8ToBytes(secret),
      utf8ToBytes(`${String(timestampS)}:${payload}`)
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

/** The header Paddle would send for `payload` at `timestampS`. */
export function signPaddlePayload(args: {
  readonly secret: string;
  readonly payload: string;
  readonly timestampS: number;
}): string {
  return `ts=${String(args.timestampS)};h1=${digest(args.secret, args.timestampS, args.payload)}`;
}

function parseHeader(
  header: string
): { readonly ts: number; readonly h1: readonly string[] } | null {
  let ts: number | null = null;
  const h1: string[] = [];
  for (const part of header.split(';')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 'ts' && value !== undefined && /^\d+$/.test(value)) {
      ts = Number(value);
    }
    if (key === 'h1' && value !== undefined && value.length > 0) h1.push(value);
  }
  return ts === null || h1.length === 0 ? null : { ts, h1 };
}

/**
 * True when some `h1` in `header` signs `payload` with `secret` and `ts` is
 * within the tolerance of `nowMs` — in either direction, so a replay from
 * the past and a forged future timestamp both fail.
 */
export function verifyPaddleSignature(args: {
  readonly secret: string;
  readonly payload: string;
  readonly header: string;
  readonly nowMs: number;
  readonly toleranceS?: number;
}): boolean {
  const parsed = parseHeader(args.header);
  if (parsed === null) return false;
  const toleranceS = args.toleranceS ?? PADDLE_SIGNATURE_TOLERANCE_S;
  if (Math.abs(args.nowMs / 1000 - parsed.ts) > toleranceS) return false;
  const expected = digest(args.secret, parsed.ts, args.payload);
  return parsed.h1.some((candidate) => sameHex(candidate, expected));
}
