import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { decodeBaselineLog, encodeBaselineLog } from './storybook-baseline-log';

export const STORYBOOK_RESULTS =
  'pkgs/ui-root-harness-ts/.cache/storybook-test-results/';
export const EVIDENCE_MANIFEST = `${STORYBOOK_RESULTS}relay-manifest.json`;

export function assertEvidencePath(path: string): void {
  if (
    !path.startsWith(STORYBOOK_RESULTS) ||
    path.includes('\\') ||
    path.includes('\0') ||
    path.split('/').some((part) => !part || part === '..' || part === '.') ||
    !/\.(png|webm|zip|json|md|txt)$/.test(path)
  )
    throw new Error(`Not a Storybook evidence path: ${path}`);
}

export function encodeEvidence(path: string, bytes: Uint8Array): string {
  assertEvidencePath(path);
  const record = {
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    data: Buffer.from(bytes).toString('base64'),
  };
  return encodeBaselineLog(gzipSync(JSON.stringify(record)).toString('base64'));
}

export function decodeEvidence(log: string): {
  path: string;
  bytes: Uint8Array;
  sha256: string;
} {
  const record = JSON.parse(
    gunzipSync(Buffer.from(decodeBaselineLog(log), 'base64'), {
      maxOutputLength: 32 * 1024 * 1024,
    }).toString('utf8')
  ) as { path: string; data: string; sha256: string };
  assertEvidencePath(record.path);
  const bytes = Buffer.from(record.data, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== record.sha256) throw new Error('Evidence checksum mismatch');
  return { path: record.path, bytes, sha256 };
}

export function decodeEvidenceBundle(log: string): {
  runId: string;
  records: ReturnType<typeof decodeEvidence>[];
} {
  const records = [...log.matchAll(/\uE100[\s\S]*?\uE101/g)].map((match) =>
    decodeEvidence(match[0])
  );
  const last = records.pop();
  if (last?.path !== EVIDENCE_MANIFEST)
    throw new Error('No final evidence manifest: incomplete transfer');
  const manifest = JSON.parse(Buffer.from(last.bytes).toString('utf8')) as {
    runId: string;
    files: { path: string; sha256: string }[];
  };
  if (
    !/^\d+$/.test(manifest.runId) ||
    records.length !== manifest.files.length ||
    new Set(records.map((record) => record.path)).size !== records.length ||
    records.some(
      (record, index) =>
        record.path !== manifest.files[index]?.path ||
        record.sha256 !== manifest.files[index]?.sha256
    )
  )
    throw new Error('Evidence manifest does not match transferred files');
  return { runId: manifest.runId, records };
}
