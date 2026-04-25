import { createHash, randomBytes } from 'node:crypto';
import { etc, getPublicKey, sign, verify } from '@noble/ed25519';
import { stableStringify } from './stable-stringify';

const enc = new TextEncoder();

/** Noble ed25519 sync APIs require an explicit SHA-512 (no sync WebCrypto in Bun/Node). */
if (typeof etc.sha512Sync !== 'function') {
  etc.sha512Sync = (...messages: Uint8Array[]) => {
    const h = createHash('sha512');
    for (const m of messages) {
      h.update(m);
    }
    return new Uint8Array(h.digest());
  };
}

/** Raw Ed25519 public key length (32 bytes). */
export const ED25519_PUBLIC_KEY_LENGTH = 32;

/** Raw Ed25519 secret seed length (32 bytes). */
export const ED25519_SECRET_SEED_LENGTH = 32;

export function randomSecretSeed(): Uint8Array {
  return randomBytes(ED25519_SECRET_SEED_LENGTH);
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
  const h = createHash('sha256').update(publicKey).digest().subarray(0, 20);
  return Buffer.from(h).toString('base64url');
}

/** Short display fingerprint (hex, first 16 bytes of sha256(pubkey)). */
export function fingerprintFromPublicKey(publicKey: Uint8Array): string {
  return createHash('sha256').update(publicKey).digest('hex').slice(0, 32);
}

export function encodeKeyB64(key: Uint8Array): string {
  return Buffer.from(key).toString('base64url');
}

export function decodeKeyB64(s: string): Uint8Array {
  const buf = Buffer.from(s, 'base64url');
  if (buf.length !== ED25519_PUBLIC_KEY_LENGTH) {
    throw new Error('invalid base64url public key length');
  }
  return new Uint8Array(buf);
}

export function sha256Hex(data: string | Uint8Array): string {
  const buf = typeof data === 'string' ? enc.encode(data) : data;
  return createHash('sha256').update(buf).digest('hex');
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

export function utf8(s: string): Uint8Array {
  return enc.encode(s);
}
