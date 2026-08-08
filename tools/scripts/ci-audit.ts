/**
 * Runs `bun audit --audit-level high`.
 *
 * Outside CI, connection failures to the audit registry are treated as a skip
 * so `bun check` can finish offline; in CI (`CI` / `GITHUB_ACTIONS`) any
 * non-zero exit from audit still fails the job.
 *
 * Ignored CVEs must stay empty unless there is no published patched release
 * (`first_patched_version: null`). Revisit when image-size ships a fix past
 * 2.0.2 (metro → expo transitive).
 */
import { spawnSync } from 'node:child_process';

const inCi =
  process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true';

/** Unpatched highs with no fixed version yet — drop once a release exists. */
const IGNORE_ADVISORIES = [
  'GHSA-w3rx-r6r6-pgpr', // image-size ICNS infinite loop (CVE-2025-71330)
  'GHSA-5p2g-fcmc-qvqq', // image-size JXL/HEIF infinite loop (CVE-2025-71329)
] as const;

function registryLikelyUnreachable(output: string): boolean {
  return /ConnectionRefused|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|Failed to fetch|audit request failed|getaddrinfo|socket hang up/i.test(
    output
  );
}

const AUDIT_TIMEOUT_MS = 60_000;

function timedOut(output: string, err: unknown): boolean {
  if (output.includes('ETIMEDOUT') || output.includes('timed out')) return true;
  if (err instanceof Error && /timed out|ETIMEDOUT/i.test(err.message)) {
    return true;
  }
  return false;
}

const r = spawnSync(
  process.execPath,
  [
    'audit',
    '--audit-level',
    'high',
    ...IGNORE_ADVISORIES.flatMap((id) => ['--ignore', id]),
  ],
  {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: AUDIT_TIMEOUT_MS,
  }
);

const status = r.status ?? 1;
const combined = `${r.stderr ?? ''}${r.stdout ?? ''}`;

if (r.error !== undefined && timedOut(combined, r.error)) {
  if (!inCi) {
    console.warn('[ci:audit] bun audit timed out; skipping audit outside CI.');
    process.exit(0);
  }
  console.error('[ci:audit] bun audit timed out.');
  process.exit(1);
}

if (status === 0) {
  if (r.stdout) process.stdout.write(r.stdout);
  process.exit(0);
}

if (!inCi && registryLikelyUnreachable(combined)) {
  console.warn(
    '[ci:audit] Registry unreachable; skipping audit outside CI.\n' +
      combined.trim()
  );
  process.exit(0);
}

if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(status);
