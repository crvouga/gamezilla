// @io-wall-ok — transfer only retained synthetic Storybook evidence, never credentials.
import { createPublicKey, randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import { downloadArtifact, githubArtifactsApi } from './ci-artifacts';
import { sealEvidence } from './storybook-evidence-crypto';
import {
  assertEvidenceFits,
  assertEvidencePath,
  decodeEvidence,
  EVIDENCE_MANIFEST,
  encodeEvidence,
  STORYBOOK_RESULTS,
} from './storybook-evidence-log';
import { restoreEvidence } from './storybook-evidence-restore';

async function exportEvidence(runId: string): Promise<void> {
  if (!/^\d+$/.test(runId))
    throw new Error('A numeric retained run is required');
  const publicKey = Buffer.from(
    process.env['STORYBOOK_EVIDENCE_PUBLIC_KEY'] ?? '',
    'base64'
  ).toString('utf8');
  if (!publicKey.trim().startsWith('-----BEGIN PUBLIC KEY-----'))
    throw new Error('An RSA public key is required; never send a private key');
  const parsed = createPublicKey(publicKey);
  if (
    parsed.asymmetricKeyType !== 'rsa' ||
    (parsed.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
  )
    throw new Error('Recipient RSA key must have at least 2048 bits');
  const emit = (record: string): void => {
    console.log(sealEvidence(record, publicKey, randomBytes(44)));
  };
  const directory = mkdtempSync(join(tmpdir(), 'storybook-evidence-'));
  const files: { path: string; sha256: string }[] = [];
  let paths: string[] = [];
  try {
    const name = `verify-nightly-storybook-${runId}`;
    if (
      !(await downloadArtifact({
        api: githubArtifactsApi(),
        runId,
        name,
        directory,
      }))
    )
      throw new Error(`No retained Storybook evidence: ${runId}`);
    const under = (path: string): string[] => {
      const absolute = join(directory, path);
      if (!existsSync(absolute)) return [];
      if (!statSync(absolute).isDirectory()) return [path];
      return readdirSync(absolute, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          slashPath(relative(directory, join(entry.parentPath, entry.name)))
        )
        .sort();
    };
    const results = under(STORYBOOK_RESULTS);
    if (!results.length)
      throw new Error(`No retained Storybook evidence: ${runId}`);
    paths = results;
    let total = 0;
    for (const path of paths) {
      assertEvidencePath(path);
      if (path === EVIDENCE_MANIFEST) throw new Error('Reserved manifest path');
      const bytes = new Uint8Array(readFileSync(join(directory, path)));
      assertEvidenceFits(bytes.byteLength, total);
      total += bytes.byteLength;
      const encoded = encodeEvidence(path, bytes);
      files.push({ path, sha256: decodeEvidence(encoded).sha256 });
      emit(encoded);
    }
  } finally {
    removeTree(directory, { whenLocked: 'leave' });
  }
  emit(
    encodeEvidence(
      EVIDENCE_MANIFEST,
      Buffer.from(JSON.stringify({ runId, files }))
    )
  );
  console.log(
    `Exported ${paths.length} Storybook evidence files from run ${runId}`
  );
}

if (import.meta.main) {
  const [, , mode, input, destination, keyPath] = process.argv;
  if (mode === '--decode-log' && input && destination && keyPath)
    await restoreEvidence(input, destination, keyPath);
  else if (mode === '--export' && process.env['STORYBOOK_EVIDENCE_RUN'])
    await exportEvidence(process.env['STORYBOOK_EVIDENCE_RUN']);
  else throw new Error('Use --export or --decode-log <log> <directory> <key>');
}
