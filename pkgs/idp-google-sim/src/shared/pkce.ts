/**
 * PKCE verification (RFC 7636), owned by the provider side.
 *
 * The IdP deliberately does not share this with any relying-party package: if
 * both sides computed the challenge with the same helper, a bug in that helper
 * would cancel itself out and the check would pass while real Google rejected.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function pkceS256Challenge(verifier: string): string {
  return base64Url(sha256(utf8ToBytes(verifier)));
}
