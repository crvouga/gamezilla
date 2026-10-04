// @io-wall-ok — writes and reads evidence files in a package's report bucket.
/**
 * Evidence lives beside the other run artifacts of a spec suite, under
 * `<reportDir>/evidence/`, written by the runner that checked the spec
 * (`@pkgs/dmn/bun-test`, `@pkgs/alloy/bun-test`, …).
 *
 * Slices of one spec run in parallel workers, so a write never reads or
 * merges: each call writes its own file, named by the spec and the ids it
 * decides (`<key>.<ids-hash>.json`). Deciding the same obligations again
 * replaces that file, so a rerun never leaves a stale verdict beside a fresh
 * one. Reading merges every file of a spec text into one record.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type { EvidenceRecord, Obligation } from '@pkgs/conformance-shared/evidence';
import { evidenceKey, isEvidenceRecord, sha256 } from '@pkgs/conformance-shared/evidence';

export function evidenceDir(reportDir: string): string {
  return join(reportDir, 'evidence');
}

/** Record `record`'s obligations in `reportDir`, atomically and without merging. */
export function recordEvidence(
  reportDir: string,
  record: EvidenceRecord
): void {
  const dir = evidenceDir(reportDir);
  mkdirSync(dir, { recursive: true });
  const ids = record.obligations
    .map((obligation) => obligation.id)
    .sort()
    .join('\n');
  const name = `${evidenceKey(record.specUri)}.${sha256(ids).slice(0, 16)}.json`;
  const file = join(dir, name);
  const temporary = `${file}.${String(process.pid)}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(temporary, file);
}

function readRecord(file: string): EvidenceRecord | null {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  return isEvidenceRecord(parsed) ? parsed : null;
}

/**
 * Every evidence record in `reportDir`, one per spec text: the files written
 * for one spec (same uri, text and package) are merged, later obligations
 * replacing earlier ones of the same id. Malformed files are reported.
 */
export function readEvidence(reportDir: string): {
  readonly records: readonly EvidenceRecord[];
  readonly malformed: readonly string[];
} {
  const dir = evidenceDir(reportDir);
  if (!existsSync(dir)) return { records: [], malformed: [] };
  const merged = new Map<string, EvidenceRecord>();
  const malformed: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const record = readRecord(join(dir, name));
    if (record === null) {
      malformed.push(join(dir, name));
      continue;
    }
    const key = `${record.specUri}\n${record.specSha256}\n${record.packageName}`;
    const earlier = merged.get(key);
    merged.set(
      key,
      earlier === undefined
        ? { ...record, obligations: sortObligations(record.obligations) }
        : {
            ...earlier,
            obligations: mergeObligations(
              earlier.obligations,
              record.obligations
            ),
          }
    );
  }
  const records = [...merged.values()].sort((a, b) =>
    a.specUri.localeCompare(b.specUri)
  );
  return { records, malformed };
}

function sortObligations(
  obligations: readonly Obligation[]
): readonly Obligation[] {
  return [...obligations].sort((a, b) => a.id.localeCompare(b.id));
}

function mergeObligations(
  earlier: readonly Obligation[],
  later: readonly Obligation[]
): readonly Obligation[] {
  const byId = new Map<string, Obligation>();
  for (const obligation of [...earlier, ...later]) {
    byId.set(obligation.id, obligation);
  }
  return sortObligations([...byId.values()]);
}
