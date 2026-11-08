import { expect, test } from 'bun:test';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { sealEvidence } from './storybook-evidence-crypto';
import {
  decodeEvidence,
  EVIDENCE_MANIFEST,
  encodeEvidence,
  STORYBOOK_RESULTS,
} from './storybook-evidence-log';
import { evidenceLines, streamEvidence } from './storybook-evidence-stream';

const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const first = encodeEvidence(
  `${STORYBOOK_RESULTS}connect-four/video.webm`,
  new Uint8Array([1, 2])
);
const last = encodeEvidence(
  EVIDENCE_MANIFEST,
  Buffer.from(
    JSON.stringify({ runId: '42434970941', files: [decodeEvidence(first)] })
  )
);
function encrypted(record: string): string[] {
  return sealEvidence(record, keys.publicKey, randomBytes(44)).split('\n');
}

// regression: storybook-evidence-decoder-buffers-whole-run
test('Connect Four recording is released before the next encrypted record is read', async () => {
  const received: string[] = [];
  async function* input() {
    yield* encrypted(first);
    expect(received).toEqual([`${STORYBOOK_RESULTS}connect-four/video.webm`]);
    yield* encrypted(last);
  }
  const manifest = await streamEvidence(input(), keys.privateKey, (record) => {
    received.push(record.path);
  });
  expect(manifest.runId).toBe('42434970941');
  expect(manifest.files[0]?.bytes).toBe(2);
});

test('a missing final manifest still rejects partially decoded evidence', async () => {
  async function* input() {
    yield* encrypted(first);
  }
  await expect(
    streamEvidence(input(), keys.privateKey, () => {})
  ).rejects.toThrow('incomplete');
});

test('records after the final manifest are rejected', async () => {
  async function* input() {
    yield* encrypted(first);
    yield* encrypted(last);
    yield* encrypted(first);
  }
  await expect(
    streamEvidence(input(), keys.privateKey, () => {})
  ).rejects.toThrow();
});

// regression: storybook-evidence-unbounded-log-line
test('newline-free input is rejected before the next read after the line budget', async () => {
  async function* chunks() {
    yield 'x'.repeat(64 * 1024);
    yield 'y';
    throw new Error('read beyond the bounded line');
  }
  const consume = async () => {
    for await (const line of evidenceLines(chunks())) void line;
  };
  await expect(consume()).rejects.toThrow('line exceeds transfer limit');
});

test('split chunks preserve empty lines and record delimiters', async () => {
  async function* chunks() {
    yield 'first\n\nse';
    yield 'cond\nlast';
  }
  const lines: string[] = [];
  for await (const line of evidenceLines(chunks())) lines.push(line);
  expect(lines).toEqual(['first', '', 'second', 'last']);
});
