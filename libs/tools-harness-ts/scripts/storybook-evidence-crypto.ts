import {
  constants,
  createCipheriv,
  createDecipheriv,
  privateDecrypt,
  publicEncrypt,
} from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { decodeBaselineLog, encodeBaselineLog } from './storybook-baseline-log';

/** Only the recipient holding the local private key can inspect captured traces. */
export function sealEvidence(
  plaintext: string,
  publicKey: string,
  entropy: Uint8Array
): string {
  if (entropy.length !== 44) throw new Error('Expected 44 bytes of entropy');
  const key = entropy.slice(0, 32);
  const iv = entropy.slice(32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([
    cipher.update(gzipSync(plaintext)),
    cipher.final(),
  ]);
  const wrapped = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    key
  );
  return encodeBaselineLog(
    JSON.stringify({
      key: wrapped.toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      body: body.toString('base64'),
    })
  );
}

export function openEvidence(encrypted: string, privateKey: string): string {
  const record = JSON.parse(decodeBaselineLog(encrypted)) as {
    key: string;
    iv: string;
    tag: string;
    body: string;
  };
  const key = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(record.key, 'base64')
  );
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(record.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return gunzipSync(
    Buffer.concat([
      decipher.update(Buffer.from(record.body, 'base64')),
      decipher.final(),
    ]),
    { maxOutputLength: 128 * 1024 * 1024 }
  ).toString('utf8');
}
