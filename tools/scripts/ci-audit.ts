/**
 * Runs `bun audit --audit-level high` (local and CI).
 *
 * Always dials the registry so local and CI share one Turbo remote-cache
 * hash for `//#ci:audit`. Any non-zero exit still fails the check/deploy.
 *
 * Ignored CVEs must stay empty unless there is no published patched release
 * (`first_patched_version: null`). Revisit when image-size ships a fix past
 * 2.0.2 (metro → expo transitive).
 */
import { spawnSync } from 'node:child_process';

/** Unpatched highs with no fixed version yet — drop once a release exists. */
const IGNORE_ADVISORIES = [
  'GHSA-w3rx-r6r6-pgpr', // image-size ICNS infinite loop (CVE-2025-71330)
  'GHSA-5p2g-fcmc-qvqq', // image-size JXL/HEIF infinite loop (CVE-2025-71329)
] as const;

const AUDIT_TIMEOUT_MS = 300_000;

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
  console.error('[ci:audit] bun audit timed out.');
  process.exit(1);
}

if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(status);
