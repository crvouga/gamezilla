/**
 * Validates Expo SDK dependency versions (`expo install --check --json`).
 *
 * - Ignores intentional monorepo skew (root catalog TypeScript 6 vs Expo's ~5.9).
 * - Times out after 60s so `bun check` does not hang on a slow registry.
 * - Outside CI, timeouts are treated as a skip (same policy as `ci:audit`).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_TIMEOUT_MS = 60_000;

/** Dev deps the monorepo pins above Expo's bundled recommendation. */
const ALLOWED_DEV_SKEW = new Set(['typescript']);

const inCi =
  process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true';

type ExpoCheckJson = {
  readonly dependencies?: ReadonlyArray<{
    readonly packageName: string;
    readonly packageType: string;
    readonly expectedVersionOrRange: string;
    readonly actualVersion: string;
  }>;
  readonly upToDate?: boolean;
};

function timedOut(output: string, err: unknown): boolean {
  if (output.includes('ETIMEDOUT') || output.includes('timed out')) return true;
  if (err instanceof Error && /timed out|ETIMEDOUT/i.test(err.message)) {
    return true;
  }
  return false;
}

function parseExpoCheckJson(stdout: string): ExpoCheckJson | null {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1)) as ExpoCheckJson;
  } catch {
    return null;
  }
}

function offendingDeps(report: ExpoCheckJson): string[] {
  const deps = report.dependencies ?? [];
  return deps
    .filter(
      (d) =>
        !(
          d.packageType === 'devDependencies' &&
          ALLOWED_DEV_SKEW.has(d.packageName)
        )
    )
    .map(
      (d) =>
        `${d.packageName}@${d.actualVersion} (expected ${d.expectedVersionOrRange}, ${d.packageType})`
    );
}

const r = spawnSync('bunx', ['expo', 'install', '--check', '--json'], {
  cwd: clientRoot,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
  timeout: CHECK_TIMEOUT_MS,
});

const combined = `${r.stdout ?? ''}${r.stderr ?? ''}`;

if (r.error !== undefined && timedOut(combined, r.error)) {
  if (!inCi) {
    console.warn(
      '[ci:expo-go-deps] expo install --check timed out; skipping outside CI.'
    );
    process.exit(0);
  }
  console.error('[ci:expo-go-deps] expo install --check timed out.');
  process.exit(1);
}

const report = parseExpoCheckJson(r.stdout ?? '');
if (report === null) {
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  process.exit(r.status ?? 1);
}

const offenders = offendingDeps(report);
if (offenders.length === 0) {
  process.exit(0);
}

console.error('[ci:expo-go-deps] Expo SDK dependency mismatch:');
for (const line of offenders) {
  console.error(`  ${line}`);
}
process.exit(1);
