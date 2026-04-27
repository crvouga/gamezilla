/**
 * Base64url without padding, using only `Buffer` + `base64` encoding.
 * The `buffer` npm polyfill (RN/Hermes) does not implement Node's `base64url` encoding.
 */
function B(): typeof globalThis.Buffer {
  const ctor = globalThis.Buffer;
  if (typeof ctor === 'undefined') {
    throw new Error('Buffer is not defined');
  }
  return ctor;
}

export function bufferToBase64Url(data: Uint8Array): string {
  return B()
    .from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function bufferFromBase64Url(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const rem = b64.length % 4;
  if (rem !== 0) {
    b64 += '='.repeat(4 - rem);
  }
  return new Uint8Array(B().from(b64, 'base64'));
}
