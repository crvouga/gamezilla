// @io-wall-ok — transfer only retained synthetic Storybook evidence, never credentials.
import { createPublicKey, randomBytes } from 'node:crypto';
import { ciArtifactsStore } from './ci-artifacts';
import { sealEvidence } from './storybook-evidence-crypto';
import {
  assertEvidencePath,
  decodeEvidence,
  EVIDENCE_MANIFEST,
  encodeEvidence,
  STORYBOOK_BASELINE_PATCH,
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
  const store = ciArtifactsStore(process.env);
  const emit = (record: string): void => {
    console.log(sealEvidence(record, publicKey, randomBytes(44)));
  };
  const prefix = `${runId}/verify-nightly-storybook-${runId}/`;
  const results = await store.listKeys(`${prefix}${STORYBOOK_RESULTS}`);
  if (!results.length)
    throw new Error(`No retained Storybook evidence: ${runId}`);
  // An authoring run also retains its reference patch; owners commit from it.
  const keys = [
    ...results,
    ...(await store.listKeys(`${prefix}${STORYBOOK_BASELINE_PATCH}`)),
  ];
  let total = 0;
  const files: { path: string; sha256: string }[] = [];
  for (const key of keys) {
    const path = key.slice(prefix.length);
    assertEvidencePath(path);
    if (path === EVIDENCE_MANIFEST) throw new Error('Reserved manifest path');
    const object = await store.get(key);
    if (!object) throw new Error(`Missing retained object: ${path}`);
    total += object.size;
    if (object.size > 20 * 1024 * 1024 || total > 512 * 1024 * 1024)
      throw new Error('Evidence exceeds the bounded log transfer size');
    const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
    const encoded = encodeEvidence(path, bytes);
    files.push({ path, sha256: decodeEvidence(encoded).sha256 });
    emit(encoded);
  }
  emit(
    encodeEvidence(
      EVIDENCE_MANIFEST,
      Buffer.from(JSON.stringify({ runId, files }))
    )
  );
  console.log(
    `Exported ${keys.length} Storybook evidence files from run ${runId}`
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
