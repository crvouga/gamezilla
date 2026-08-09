/**
 * Ban silent wall I/O fallbacks in product runtime.
 *
 * Production code must not call resolveNow()/resolveTimers()/resolveCreateId()/
 * resolveRandom()/resolveClock() with no argument, nor construct wall adapters
 * (createGlobalHttpClient, wallIo, wallClock, …) outside composition roots.
 *
 * Burn-down: tools/io-resolve-allowlist.json
 * GENERATE_ALLOWLIST=1 rewrites the allowlist from current offenses.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { collectIoScanFiles, REPO_ROOT } from './io-scan-roots';

const ALLOWLIST_PATH = join(REPO_ROOT, 'tools/io-resolve-allowlist.json');

/** Permanent allow — wall adapters + package barrels + composition roots only. */
const PERMANENT_PREFIXES = [
  'pkgs/clock/src/wall.ts',
  'pkgs/clock/src/index.ts',
  'pkgs/http-client/src/global.ts',
  'pkgs/uuid/src/create-id.ts',
  'pkgs/uuid/src/index.ts',
  'pkgs/io/src/wall-io.ts',
  'pkgs/io/src/sim-io.ts',
  'apps/client/src/providers/infrastructure/app-io-provider.tsx',
  'apps/client/src/polyfill-entry.ts',
  'apps/api/src/app/create-app.ts',
  'apps/api/src/api.ts',
  'apps/api/src/config/object-store.ts',
  'apps/api/src/db/migrate.ts',
  'apps/api/src/db/migrate-cli.ts',
  'apps/postgres/scripts/migrate.ts',
  'apps/postgres/scripts/seed.ts',
  'pkgs/observability/src/impl-local-file/summarize-cli.ts',
  'pkgs/observability/src/impl-local-file/dev.ts',
  // Assert default crash handler (module-level wallTimers for browser overlay).
  'pkgs/assert/src/crash/default-crash-handler.ts',
  // Package utilities with module-level wallIo for silent/structured loggers.
  'pkgs/async/src/fire-and-forget.ts',
  'pkgs/kv/src/use-kv-state.ts',
  'pkgs/sync-engine/src/client/local-schema-migrate.ts',
  'pkgs/sync-engine/src/test/in-memory-sync-engine.ts',
  // Infra CLI composition root (module-level wallIo).
  'libs/infra/src/cli/lib/cli-io.ts',
  // Chess puzzle seeder CLI entry.
  'libs/chess/scripts/seed-chess-puzzles.ts',
  'libs/chess/src/server/seed-chess-puzzle/export-chess-puzzles-load.ts',
  // Script / e2e harness composition roots (module-level wallIo).
  'apps/api/scripts/dev.ts',
  'apps/api/scripts/preview-serve.ts',
  'apps/api/scripts/setup-dev-vars.ts',
  'apps/api/scripts/wipe-dev-db.ts',
  'apps/client/scripts/ios-dedicated-sim.ts',
  'apps/client/scripts/preview-stack-ready.ts',
  'apps/client/scripts/setup-sentry-dsn.ts',
  'libs/client-config/scripts/dev-refresh-client-config.ts',
  'libs/integration-test/e2e/scenarios/chess-puzzle-loop.ts',
  'libs/integration-test/e2e/setup/ensure-chess-puzzles-seeded.ts',
  'libs/integration-test/e2e/support/chess/chess-puzzle-play.ts',
  'libs/integration-test/e2e/support/sleep.ts',
  'libs/integration-test/e2e/web/better-auth-adapter.ts',
  'libs/integration-test/e2e/web/web-session.ts',
  'libs/integration-test/scripts/wait-for-api-health.ts',
  'libs/integration-test/src/e2e-step.ts',
  'libs/integration-test/src/harness.ts',
  'libs/integration-test/src/local-e2e-stack.ts',
  'pkgs/sounds/scripts/fetch-kenney-packs.ts',
  'tools/scripts/run-postgres-migrations-secrets.ts',
  // UI explorer examples (composition roots for demos).
  'pkgs/ui/src/components/explorer/example-root.tsx',
  'pkgs/ui/src/components/command-palette/command-palette.example.tsx',
  // Sync sim local SQLite open (silent migrate logger).
  'pkgs/sync-engine/src/sim/open-sim-sqlite.ts',
  // Tooling secret-store composition root.
  'pkgs/secret-provider/src/create-configured-secret-store.ts',
];

type Ban = {
  readonly kind: string;
  readonly re: RegExp;
  /** When true, test files are allowed to use this pattern. */
  readonly allowInTests?: boolean;
};

const BANS: readonly Ban[] = [
  { kind: 'resolveNow()', re: /\bresolveNow\s*\(\s*\)/ },
  { kind: 'resolveTimers()', re: /\bresolveTimers\s*\(\s*\)/ },
  { kind: 'resolveCreateId()', re: /\bresolveCreateId\s*\(\s*\)/ },
  { kind: 'resolveRandom()', re: /\bresolveRandom\s*\(\s*\)/ },
  { kind: 'resolveClock()', re: /\bresolveClock\s*\(\s*\)/ },
  {
    kind: 'createGlobalHttpClient()',
    re: /\bcreateGlobalHttpClient\s*\(\s*\)/,
  },
  {
    kind: 'wallIo()',
    re: /\bwallIo\s*\(\s*\)/,
    allowInTests: true,
  },
  {
    kind: 'wallClock',
    re: /\bwallClock\b/,
    allowInTests: true,
  },
  {
    kind: 'wallTimers',
    re: /\bwallTimers\b/,
    allowInTests: true,
  },
  {
    kind: 'cryptoCreateId',
    re: /\bcryptoCreateId\b/,
    allowInTests: true,
  },
  {
    kind: 'mathRandom',
    re: /\bmathRandom\b/,
    allowInTests: true,
  },
];

type Offense = {
  readonly path: string;
  readonly line: number;
  readonly kind: string;
};

function offenseKey(o: Offense): string {
  return `${o.path}:${String(o.line)}:${o.kind}`;
}

function isTestFile(rel: string): boolean {
  return (
    /\.test\.[tj]sx?$/.test(rel) ||
    /\.spec\.[tj]sx?$/.test(rel) ||
    /(?:^|\/)test-harness\.tsx?$/.test(rel) ||
    rel.includes('/tests/') ||
    rel.includes('/testing/') ||
    rel.endsWith('.bench.ts') ||
    rel.endsWith('.bench.tsx')
  );
}

function isPermanentAllow(rel: string): boolean {
  return PERMANENT_PREFIXES.some((p) => rel === p || rel.startsWith(`${p}/`));
}

function stripLineComment(line: string): string {
  const trimmed = line.trim();
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  ) {
    return '';
  }
  const idx = line.indexOf('//');
  if (idx >= 0) return line.slice(0, idx);
  return line;
}

function scanFile(abs: string): Offense[] {
  const rel = relative(REPO_ROOT, abs);
  if (isPermanentAllow(rel)) return [];
  const testFile = isTestFile(rel);
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  const out: Offense[] = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripLineComment(lines[i] ?? '');
    if (code.length === 0) continue;
    for (const ban of BANS) {
      if (ban.allowInTests && testFile) continue;
      if (!ban.re.test(code)) continue;
      out.push({ path: rel, line: i + 1, kind: ban.kind });
    }
  }
  return out;
}

function loadAllowlist(): Set<string> {
  if (!existsSync(ALLOWLIST_PATH)) return new Set();
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(
      'io-resolve-allowlist.json must be a JSON array of strings'
    );
  }
  return new Set(raw.map((x) => String(x)));
}

const files = collectIoScanFiles();
const offenses: Offense[] = [];
for (const f of files) {
  offenses.push(...scanFile(f));
}

if (process.env['GENERATE_ALLOWLIST'] === '1') {
  const keys = [...new Set(offenses.map(offenseKey))].sort();
  writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(keys, null, 2)}\n`);
  console.log(
    `Wrote ${String(keys.length)} allowlist entries → tools/io-resolve-allowlist.json`
  );
  process.exit(0);
}

const allow = loadAllowlist();
const offenseKeys = new Set(offenses.map(offenseKey));

const unexpected = offenses.filter((o) => !allow.has(offenseKey(o)));
const stale = [...allow].filter((k) => !offenseKeys.has(k));

if (unexpected.length > 0 || stale.length > 0) {
  if (unexpected.length > 0) {
    console.error(
      'Silent wall-I/O fallback check failed — inject Io via constructor or React context (useIo / getIo):\n'
    );
    for (const o of unexpected.slice(0, 200)) {
      console.error(`  - ${offenseKey(o)}`);
    }
    if (unexpected.length > 200) {
      console.error(`  … and ${String(unexpected.length - 200)} more`);
    }
  }
  if (stale.length > 0) {
    console.error(
      '\nStale allowlist entries (remove from tools/io-resolve-allowlist.json):\n'
    );
    for (const k of stale.slice(0, 100)) {
      console.error(`  - ${k}`);
    }
  }
  process.exit(1);
}

console.log(
  `No-resolve-wall-defaults check passed (${String(files.length)} files, ${String(offenses.length)} allowlisted, ${String(allow.size)} allowlist entries).`
);
