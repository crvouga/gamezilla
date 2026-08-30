import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** Peppered SHA-256 of a bearer / exchange code (never store plaintext). */
export function hashAuthSecret(secret: string, value: string): string {
  return bytesToHex(sha256(utf8ToBytes(`${secret}\0${value}`)));
}
