import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

/** Base64url without padding (PKCE S256 challenge). */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** RFC 7636 S256: BASE64URL(SHA256(ASCII(code_verifier))). */
export function pkceS256Challenge(verifier: string): string {
  return base64UrlEncode(sha256(utf8ToBytes(verifier)));
}
