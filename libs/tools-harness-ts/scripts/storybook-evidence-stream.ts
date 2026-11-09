import { openEvidence } from './storybook-evidence-crypto';
import {
  decodeEvidence,
  EVIDENCE_MANIFEST,
  validateEvidenceManifest,
} from './storybook-evidence-log';

export type EvidenceRecord = ReturnType<typeof decodeEvidence>;
type EvidenceFile = { path: string; sha256: string; bytes: number };

export async function* evidenceLines(chunks: AsyncIterable<string>) {
  let pending = '';
  for await (const chunk of chunks) {
    for (const [index, part] of chunk.split('\n').entries()) {
      if (index > 0) {
        yield pending;
        pending = '';
      }
      if (pending.length + part.length > 64 * 1024)
        throw new Error('Evidence log line exceeds transfer limit');
      pending += part;
    }
  }
  if (pending) yield pending;
}

async function* envelopes(lines: AsyncIterable<string>) {
  let record: string[] | undefined;
  let size = 0;
  for await (const line of lines) {
    if (line.includes('\uE100')) {
      if (record) throw new Error('Nested evidence record');
      record = [];
      size = 0;
    }
    if (record) {
      size += line.length + 1;
      if (size > 128 * 1024 * 1024)
        throw new Error('Evidence record exceeds transfer limit');
      record.push(line);
    }
    if (line.includes('\uE101')) {
      if (!record) throw new Error('Evidence record has no beginning');
      yield record.join('\n');
      record = undefined;
    }
  }
  if (record) throw new Error('Evidence record is incomplete');
}

export async function streamEvidence(
  lines: AsyncIterable<string>,
  privateKey: string,
  receive: (record: EvidenceRecord) => Promise<void> | void
): Promise<{ runId: string; files: EvidenceFile[] }> {
  const files: EvidenceFile[] = [];
  const paths = new Set<string>();
  let manifest: EvidenceRecord | undefined;
  for await (const encrypted of envelopes(lines)) {
    if (manifest) throw new Error('Evidence follows the final manifest');
    const record = decodeEvidence(openEvidence(encrypted, privateKey));
    if (record.path === EVIDENCE_MANIFEST) {
      manifest = record;
      continue;
    }
    if (paths.has(record.path)) throw new Error('Duplicate evidence path');
    paths.add(record.path);
    await receive(record);
    files.push({
      path: record.path,
      sha256: record.sha256,
      bytes: record.bytes.length,
    });
  }
  return { runId: validateEvidenceManifest(manifest, files), files };
}
