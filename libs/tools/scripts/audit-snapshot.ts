// @io-wall-ok — fetch current registry evidence before running the pure cached gate.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { redactSecrets } from './check-shard-stream';

export const AUDIT_SNAPSHOT = '.cache/check-ci/audit.json';
// Preserve the existing policy: unpatched advisories only, no new exemptions.
const IGNORE = ['GHSA-w3rx-r6r6-pgpr', 'GHSA-5p2g-fcmc-qvqq'];
export type AuditSnapshot = {
  version: 1;
  status: number;
  advisories: unknown;
  error?: string;
};

/** Object key order is transport metadata, rather than an advisory change. */
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, ordered(item)])
    );
  return value;
}

export function captureAudit(root: string): number {
  const started = process.hrtime.bigint();
  const result = spawnSync(
    process.execPath,
    [
      'audit',
      '--audit-level',
      'high',
      ...IGNORE.flatMap((id) => ['--ignore', id]),
      '--json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 300_000,
    }
  );
  let snapshot: AuditSnapshot;
  try {
    snapshot = {
      version: 1,
      status: result.status ?? 1,
      advisories: ordered(JSON.parse(result.stdout)),
    };
  } catch {
    snapshot = {
      version: 1,
      status: 1,
      advisories: null,
      error: redactSecrets(
        result.error?.message ??
          result.stderr ??
          'Registry produced no structured audit evidence',
        process.env
      ),
    };
  }
  const path = join(root, AUDIT_SNAPSHOT);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot));
  const milliseconds = Number(process.hrtime.bigint() - started) / 1e6;
  console.log(
    `Current advisory evidence: ${milliseconds.toFixed(1)}ms; verdict ${snapshot.status}; no task hashes depend on fetch time`
  );
  return milliseconds;
}
