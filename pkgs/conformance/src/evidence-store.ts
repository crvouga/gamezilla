// @io-wall-ok — writes and reads evidence files in a package's report bucket.
/**
 * Evidence lives beside the other run artifacts of a spec suite:
 * `<reportDir>/evidence/<key>.json`, one file per spec file, written by the
 * runner that checked it (`@pkgs/dmn/bun-test`, `@pkgs/alloy/bun-test`, …).
 * A spec checked in slices merges its obligations across slices.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import {
  type EvidenceRecord,
  evidenceKey,
  isEvidenceRecord,
  type Obligation,
} from './evidence';

export function evidenceDir(reportDir: string): string {
  return join(reportDir, 'evidence');
}

/**
 * Add `obligations` to the spec's evidence file in `reportDir`. An obligation
 * already recorded under the same id is replaced, so a rerun never leaves a
 * stale verdict beside a fresh one.
 */
export function recordEvidence(
  reportDir: string,
  record: EvidenceRecord
): void {
  const dir = evidenceDir(reportDir);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${evidenceKey(record.specUri)}.json`);
  const earlier = readRecord(file);
  const merged =
    earlier !== null && earlier.specSha256 === record.specSha256
      ? mergeObligations(earlier.obligations, record.obligations)
      : record.obligations;
  writeFileSync(
    file,
    `${JSON.stringify({ ...record, obligations: merged }, null, 2)}\n`
  );
}

function mergeObligations(
  earlier: readonly Obligation[],
  later: readonly Obligation[]
): readonly Obligation[] {
  const byId = new Map<string, Obligation>();
  for (const obligation of [...earlier, ...later]) {
    byId.set(obligation.id, obligation);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function readRecord(file: string): EvidenceRecord | null {
  if (!existsSync(file)) return null;
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  return isEvidenceRecord(parsed) ? parsed : null;
}

/** Every well-formed evidence record in `reportDir`; malformed files are reported. */
export function readEvidence(reportDir: string): {
  readonly records: readonly EvidenceRecord[];
  readonly malformed: readonly string[];
} {
  const dir = evidenceDir(reportDir);
  if (!existsSync(dir)) return { records: [], malformed: [] };
  const records: EvidenceRecord[] = [];
  const malformed: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const record = readRecord(join(dir, name));
    if (record === null) malformed.push(join(dir, name));
    else records.push(record);
  }
  return { records, malformed };
}
