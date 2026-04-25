import { assert } from '@gamezilla/lib/assert';
import { sha256, sha512 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import { etc, getPublicKey, sign, verify } from '@noble/ed25519';
import { bufferFromBase64Url, bufferToBase64Url } from './buffer-base64url';
import { stableStringify } from './stable-stringify';

assert.ok(
  typeof globalThis.crypto?.getRandomValues === 'function',
  'crypto.getRandomValues must exist for peer-store (polyfill + WebCrypto)'
);
assert.ok(typeof Buffer !== 'undefined', 'Buffer must exist (peer-store peer-crypto)');
assert.notThrows(
  () => {
    sha256(new Uint8Array([1, 2, 3]));
    randomBytes(1);
  },
  'peer-store crypto smoke (sha256 + randomBytes)'
);
assert.notThrows(
  () => {
    const u = new Uint8Array([0, 255, 1, 44]);
    const dec = bufferFromBase64Url(bufferToBase64Url(u));
    assert.ok(
      dec.length === u.length && dec.every((b, i) => b === u[i]),
      'base64url codec round-trip'
    );
  },
  'peer-store base64url (Buffer+base64) codec must work'
);

const enc = new TextEncoder();

function secureRandomBytes(length: number): Uint8Array {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available');
  }
  const out = new Uint8Array(length);
  c.getRandomValues(out);
  return out;
}

/** CSPRNG bytes (Metro-safe; uses WebCrypto, not `node:crypto`). */
export function randomBytes(length: number): Buffer {
  return Buffer.from(secureRandomBytes(length));
}

/** @internal */
export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Noble ed25519 sync APIs require an explicit SHA-512 (no sync WebCrypto in Bun/Node). */
if (typeof etc.sha512Sync !== 'function') {
  etc.sha512Sync = (...messages: Uint8Array[]) => {
    return sha512(concatBytes(messages));
  };
}

/** Raw Ed25519 public key length (32 bytes). */
export const ED25519_PUBLIC_KEY_LENGTH = 32;

/** Raw Ed25519 secret seed length (32 bytes). */
export const ED25519_SECRET_SEED_LENGTH = 32;

export function randomSecretSeed(): Uint8Array {
  return secureRandomBytes(ED25519_SECRET_SEED_LENGTH);
}

export function publicKeyFromSecretSeed(secretSeed: Uint8Array): Uint8Array {
  if (secretSeed.length !== ED25519_SECRET_SEED_LENGTH) {
    throw new Error('secret seed must be 32 bytes');
  }
  return getPublicKey(secretSeed);
}

/**
 * Self-certifying peer id: base64url(first 20 bytes of sha256(pubkey)).
 */
export function peerIdFromPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== ED25519_PUBLIC_KEY_LENGTH) {
    throw new Error('public key must be 32 bytes');
  }
  const h = sha256(publicKey).subarray(0, 20);
  return bufferToBase64Url(h);
}

/** Short display fingerprint (hex, first 16 bytes of sha256(pubkey)). */
export function fingerprintFromPublicKey(publicKey: Uint8Array): string {
  return bytesToHex(sha256(publicKey).subarray(0, 16));
}

export function encodeKeyB64(key: Uint8Array): string {
  return bufferToBase64Url(key);
}

export function decodeKeyB64(s: string): Uint8Array {
  const buf = bufferFromBase64Url(s);
  if (buf.length !== ED25519_PUBLIC_KEY_LENGTH) {
    throw new Error('invalid base64url public key length');
  }
  return buf;
}

export function sha256Hex(data: string | Uint8Array): string {
  const buf = typeof data === 'string' ? enc.encode(data) : data;
  return bytesToHex(sha256(buf));
}

/**
 * Room binding proof: peers with the same `roomSecret` and `topic` compute
 * the same value. Included in signed wire material.
 */
export function computeRoomProof(roomSecret: string, topic: string): string {
  return sha256Hex(
    stableStringify({
      scheme: 'peer-store-room-v1',
      roomSecret,
      topic,
    }),
  );
}

export function signDetached(
  messageUtf8: Uint8Array,
  secretSeed: Uint8Array,
): Uint8Array {
  return sign(messageUtf8, secretSeed);
}

export function verifyDetached(
  messageUtf8: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  if (signature.length !== 64) return false;
  try {
    return verify(signature, messageUtf8, publicKey);
  } catch {
    return false;
  }
}

export function utf8(s: string): Uint8Array {
  return enc.encode(s);
}
