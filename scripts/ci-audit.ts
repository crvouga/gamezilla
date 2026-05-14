/**
 * Runs `bun audit --audit-level high`.
 *
 * Outside CI, connection failures to the audit registry are treated as a skip
 * so `bun check` can finish offline; in CI (`CI` / `GITHUB_ACTIONS`) any
 * non-zero exit from audit still fails the job.
 */
import { spawnSync } from 'node:child_process';

const inCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

function registryLikelyUnreachable(output: string): boolean {
  return /ConnectionRefused|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|Failed to fetch|audit request failed|getaddrinfo|socket hang up/i.test(
    output
  );
}

const r = spawnSync(process.execPath, ['audit', '--audit-level', 'high'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

const status = r.status ?? 1;
const combined = `${r.stderr ?? ''}${r.stdout ?? ''}`;

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
