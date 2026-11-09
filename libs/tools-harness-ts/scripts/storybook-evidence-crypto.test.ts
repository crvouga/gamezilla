import { expect, test } from 'bun:test';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { decodeBaselineLog, encodeBaselineLog } from './storybook-baseline-log';
import { openEvidence, sealEvidence } from './storybook-evidence-crypto';

const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

test('export logs reveal no trace content and require the recipient private key', () => {
  const trace = 'synthetic trace with a credential-like accidental value';
  const encrypted = sealEvidence(trace, keys.publicKey, randomBytes(44));
  expect(decodeBaselineLog(encrypted)).not.toContain(trace);
  expect(openEvidence(encrypted, keys.privateKey)).toBe(trace);
  expect(() => openEvidence(encrypted, keys.publicKey)).toThrow();
});

test('authenticated encryption rejects tampered evidence before decoding', () => {
  const encrypted = sealEvidence('record', keys.publicKey, randomBytes(44));
  const envelope = JSON.parse(decodeBaselineLog(encrypted)) as { tag: string };
  envelope.tag = Buffer.alloc(16).toString('base64');
  expect(() =>
    openEvidence(encodeBaselineLog(JSON.stringify(envelope)), keys.privateKey)
  ).toThrow();
});
