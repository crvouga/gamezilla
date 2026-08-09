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
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const ALLOWLIST_PATH = join(REPO_ROOT, 'tools/io-resolve-allowlist.json');

const SKIP_DIR = new Set([
  'node_modules',
  'dist',
  '.git',
  '.turbo',
  'coverage',
  '.expo',
  '.wrangler',
  'ios',
  'android',
  'scripts',
  'data',
]);

/** Permanent allow — wall adapters + package barrels + composition roots only. */
const PERMANENT_PREFIXES = [
  'pkgs/clock/src/wall.ts',
  'pkgs/clock/src/index.ts',
  'pkgs/http-client/src/global.ts',
  'pkgs/http-client/src/http-client-context.tsx',
  'pkgs/uuid/src/create-id.ts',
  'pkgs/uuid/src/index.ts',
  'pkgs/uuid/src/create-id-context.tsx',
  'pkgs/clock/src/clock-context.tsx',
  'pkgs/io/src/wall-io.ts',
  'pkgs/io/src/sim-io.ts',
  'pkgs/io/src/io-context.tsx',
  'apps/client/src/providers/infrastructure/app-io-provider.tsx',
  'apps/client/src/polyfill-entry.ts',
  'apps/api/src/app/create-app.ts',
  'apps/api/src/app/request-db-middleware.ts',
  'apps/api/src/api.ts',
  'apps/api/src/db/migrate.ts',
  'apps/api/src/db/migrate-cli.ts',
  'pkgs/observability/src/impl-local-file/summarize-cli.ts',
  'pkgs/observability/src/impl-local-file/dev.ts',
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
  { kind: 'createGlobalHttpClient()', re: /\bcreateGlobalHttpClient\s*\(\s*\)/ },
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

function walk(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      walk(abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (entry.name.endsWith('.d.ts')) continue;
    out.push(abs);
  }
}

function collectScanFiles(): string[] {
  const files: string[] = [];
  const client = join(REPO_ROOT, 'apps/client/src');
  const api = join(REPO_ROOT, 'apps/api/src');
  if (existsSync(client)) walk(client, files);
  if (existsSync(api)) walk(api, files);

  const libsRoot = join(REPO_ROOT, 'libs');
  if (existsSync(libsRoot)) {
    for (const name of readdirSync(libsRoot)) {
      const base = join(libsRoot, name, 'src');
      for (const runtime of ['client', 'server', 'shared'] as const) {
        const dir = join(base, runtime);
        try {
          if (statSync(dir).isDirectory()) walk(dir, files);
        } catch {
          // missing
        }
      }
    }
  }

  const pkgsRoot = join(REPO_ROOT, 'pkgs');
  if (existsSync(pkgsRoot)) {
    for (const name of readdirSync(pkgsRoot)) {
      const src = join(pkgsRoot, name, 'src');
      try {
        if (statSync(src).isDirectory()) walk(src, files);
      } catch {
        // missing
      }
    }
  }
  return files;
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
    // Import-only lines of wall symbols are still coupling — flag them.
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

const files = collectScanFiles();
const offenses: Offense[] = [];
for (const f of files) {
  offenses.push(...scanFile(f));
}

if (process.env.GENERATE_ALLOWLIST === '1') {
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
