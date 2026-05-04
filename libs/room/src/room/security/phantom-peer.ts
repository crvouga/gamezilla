import { sha256 } from '@noble/hashes/sha2.js';
import { utf8 } from './peer-crypto';

const PHANTOM_LABEL = ':gamezilla-room-phantom-v1' as const;

const ED25519_SEED_BYTES = 32 as const;

/**
 * Deterministic 32-byte Ed25519 seed for the per-space "phantom" peer that
 * satisfies Room genesis `>= 2` membership without a second real device.
 */
export function derivePhantomSecretSeed(spaceId: string): Uint8Array {
  const h = sha256(utf8(`${spaceId}${PHANTOM_LABEL}`));
  return Uint8Array.from(h.subarray(0, ED25519_SEED_BYTES));
}
