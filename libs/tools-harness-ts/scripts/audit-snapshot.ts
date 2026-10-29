// @io-wall-ok — fetch current registry evidence before running the pure cached gate.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { redactSecrets } from './verify-shard-stream';

export const AUDIT_SNAPSHOT = '.cache/verify-ci/audit.json';
// No advisory is exempt: a high or critical advisory in the lockfile fails.
export type AuditSnapshot = {
  version: 1;
  status: number;
  advisories: unknown;
  error?: string;
  /** Registry verdict a `report` run did not enforce. */
  reported?: number;
};

/**
 * `enforce` fails the gate on a current advisory: pull requests and Verify
 * Nightly. `report` records the same evidence without failing it: Release
 * verifies a commit a pull request already cleared, and an advisory published
 * between the merge and the release is not a change to that commit.
 */
export const ADVISORIES_ENV = 'VERIFY_ADVISORIES';

export function advisoryMode(env: NodeJS.ProcessEnv): 'enforce' | 'report' {
  const mode = env[ADVISORIES_ENV]?.trim() ?? '';
  if (mode === '' || mode === 'enforce') return 'enforce';
  if (mode === 'report') return 'report';
  throw new Error(`${ADVISORIES_ENV}=${mode} is not enforce or report`);
}

/** The verdict a gate records for what the registry said. */
export function recordVerdict(
  snapshot: AuditSnapshot,
  mode: 'enforce' | 'report'
): AuditSnapshot {
  if (mode === 'enforce' || snapshot.status === 0) return snapshot;
  return { ...snapshot, status: 0, reported: snapshot.status };
}

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

export function captureAudit(
  root: string,
  env: NodeJS.ProcessEnv = process.env
): number {
  const mode = advisoryMode(env);
  const started = process.hrtime.bigint();
  const result = spawnSync(
    process.execPath,
    ['audit', '--audit-level', 'high', '--json'],
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
        env
      ),
    };
  }
  snapshot = recordVerdict(snapshot, mode);
  const path = join(root, AUDIT_SNAPSHOT);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot));
  const milliseconds = Number(process.hrtime.bigint() - started) / 1e6;
  console.log(
    `Current advisory evidence: ${milliseconds.toFixed(1)}ms; verdict ${snapshot.status}${snapshot.reported === undefined ? '' : ` (registry ${snapshot.reported}, reported not enforced)`}; no task hashes depend on fetch time`
  );
  return milliseconds;
}
