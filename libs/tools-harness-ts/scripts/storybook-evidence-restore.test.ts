import { expect, test } from 'bun:test';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { sealEvidence } from './storybook-evidence-crypto';
import {
  decodeEvidence,
  EVIDENCE_MANIFEST,
  encodeEvidence,
  STORYBOOK_RESULTS,
} from './storybook-evidence-log';
import { restoreEvidence } from './storybook-evidence-restore';

const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const path = `${STORYBOOK_RESULTS}connect-four/video.webm`;
const file = encodeEvidence(path, new Uint8Array([1, 2]));
const final = encodeEvidence(
  EVIDENCE_MANIFEST,
  Buffer.from(
    JSON.stringify({
      runId: '42434970941',
      files: [decodeEvidence(file)],
    })
  )
);
function prepare(records: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'evidence-restore-'));
  const log = join(root, 'export.log');
  const key = join(root, 'recipient.pem');
  const destination = join(root, 'bundle');
  writeFileSync(key, keys.privateKey, { mode: 0o600 });
  writeFileSync(
    log,
    records
      .map((record) => sealEvidence(record, keys.publicKey, randomBytes(44)))
      .join('\n')
  );
  return { root, log, key, destination };
}

// regression: storybook-evidence-trailing-destination-slash
test('only a complete authenticated bundle becomes visible at its destination', async () => {
  const fixture = prepare([file, final]);
  try {
    await restoreEvidence(fixture.log, `${fixture.destination}/`, fixture.key);
    expect(readFileSync(join(fixture.destination, path))).toEqual(
      Buffer.from([1, 2])
    );
    const manifest = JSON.parse(
      readFileSync(join(fixture.destination, 'evidence-manifest.json'), 'utf8')
    );
    expect(manifest).toMatchObject({
      runId: '42434970941',
      files: [{ path, bytes: 2 }],
    });
    await expect(
      restoreEvidence(fixture.log, fixture.destination, fixture.key)
    ).rejects.toThrow('must not exist');
    expect(
      readdirSync(fixture.root).filter((name) => name.includes('.partial-'))
    ).toEqual([]);
  } finally {
    removeTree(fixture.root);
  }
});

test('an interrupted transfer removes staged files and never publishes a partial bundle', async () => {
  const fixture = prepare([file]);
  try {
    await expect(
      restoreEvidence(fixture.log, fixture.destination, fixture.key)
    ).rejects.toThrow('incomplete');
    expect(existsSync(fixture.destination)).toBe(false);
    expect(
      readdirSync(fixture.root).filter((name) => name.includes('.partial-'))
    ).toEqual([]);
  } finally {
    removeTree(fixture.root);
  }
});

test('a mismatched final manifest cannot publish authenticated but incomplete evidence', async () => {
  const fixture = prepare([final]);
  try {
    await expect(
      restoreEvidence(fixture.log, fixture.destination, fixture.key)
    ).rejects.toThrow('does not match');
    expect(existsSync(fixture.destination)).toBe(false);
    expect(
      readdirSync(fixture.root).filter((name) => name.includes('.partial-'))
    ).toEqual([]);
  } finally {
    removeTree(fixture.root);
  }
});
