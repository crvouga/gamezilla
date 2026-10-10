import type { CreateId } from '@pkgs/uuid-shared/create-id';

const encoder = new TextEncoder();
async function key(secret: string): Promise<CryptoKey> {
  if (secret.length < 32)
    throw new Error(
      'Synthetic Population credential secret must have at least 32 characters'
    );
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Authenticated encryption binds the credential to its persistent Synthetic User. */
export async function sealCredential(
  secret: string,
  userId: string,
  password: string,
  createId: CreateId
): Promise<string> {
  const nonce = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(createId()))
  ).slice(0, 12);
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(userId) },
    await key(secret),
    encoder.encode(password)
  );
  return JSON.stringify({
    version: 1,
    nonce: Array.from(nonce),
    data: Array.from(new Uint8Array(data)),
  });
}

export async function openCredential(
  secret: string,
  userId: string,
  sealed: string
): Promise<string> {
  const value: unknown = JSON.parse(sealed);
  if (value === null || typeof value !== 'object')
    throw new Error('Unsupported credential envelope');
  const record = value as { version: unknown; nonce: number[]; data: number[] };
  if (
    record.version !== 1 ||
    !Array.isArray(record.nonce) ||
    record.nonce.length !== 12 ||
    !Array.isArray(record.data)
  )
    throw new Error('Unsupported credential envelope');
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(record.nonce),
      additionalData: encoder.encode(userId),
    },
    await key(secret),
    new Uint8Array(record.data)
  );
  return new TextDecoder().decode(plain);
}
