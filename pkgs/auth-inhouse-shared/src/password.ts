/** Portable password hashing for the browser, Bun and Worker auth adapters. */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;
const ITERATIONS = 600_000;

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

/** Salt comes from the composition root's cryptographically secure id port. */
export async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const encoded = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoded.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: ITERATIONS,
      salt: encoded.encode(salt),
    },
    key,
    256
  );
  return hex(new Uint8Array(bits));
}

export function equalPasswordHash(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
