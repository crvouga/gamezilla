/**
 * Extremely strict bare-I/O gate for product runtime.
 *
 * Ban Date.now / performance.now / zero-arg new Date / timers / fetch /
 * crypto.randomUUID / Math.random / crypto.getRandomValues outside wall
 * adapters. Temporary burn-down: tools/io-bare-allowlist.json
 *
 * GENERATE_ALLOWLIST=1 rewrites the allowlist from current offenses.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { collectIoScanFiles, REPO_ROOT } from './io-scan-roots';

const ALLOWLIST_PATH = join(REPO_ROOT, 'tools/io-bare-allowlist.json');

/** Permanent allow — wall adapters + polyfills only. */
const PERMANENT_PREFIXES = [
  'pkgs/clock/src/wall.ts',
  'pkgs/http-client/src/global.ts',
  'pkgs/uuid/src/create-id.ts',
  'pkgs/io/src/wall-io.ts',
  'pkgs/io/src/sim-io.ts',
  'apps/client/src/polyfill-entry.ts',
];

type Ban = {
  readonly kind: string;
  readonly re: RegExp;
};

const BANS: readonly Ban[] = [
  { kind: 'Date.now', re: /\bDate\.now\s*\(/ },
  { kind: 'performance.now', re: /\bperformance\.now\s*\(/ },
  { kind: 'new Date()', re: /\bnew\s+Date\s*\(\s*\)/ },
  { kind: 'setTimeout', re: /(?:^|[^\w.])setTimeout\s*\(/ },
  { kind: 'clearTimeout', re: /(?:^|[^\w.])clearTimeout\s*\(/ },
  { kind: 'setInterval', re: /(?:^|[^\w.])setInterval\s*\(/ },
  { kind: 'clearInterval', re: /(?:^|[^\w.])clearInterval\s*\(/ },
  { kind: 'bare fetch', re: /(?:^|[^.\w])fetch\s*\(/ },
  { kind: 'globalThis.fetch', re: /globalThis\.fetch/ },
  { kind: 'crypto.randomUUID', re: /crypto\.randomUUID\s*\(/ },
  { kind: 'Math.random', re: /\bMath\.random\s*\(/ },
  { kind: 'crypto.getRandomValues', re: /crypto\.getRandomValues\s*\(/ },
];

type Offense = {
  readonly path: string;
  readonly line: number;
  readonly kind: string;
};

function offenseKey(o: Offense): string {
  return `${o.path}:${String(o.line)}:${o.kind}`;
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
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  const out: Offense[] = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripLineComment(lines[i] ?? '');
    if (code.length === 0) continue;
    for (const ban of BANS) {
      if (!ban.re.test(code)) continue;
      // Worker / DO handler method defs: `async fetch(request)` — not a call.
      if (
        (ban.kind === 'bare fetch' || ban.kind === 'globalThis.fetch') &&
        /^\s*(async\s+)?fetch\s*\(/.test(code)
      ) {
        continue;
      }
      out.push({ path: rel, line: i + 1, kind: ban.kind });
    }
  }
  return out;
}

function loadAllowlist(): Set<string> {
  if (!existsSync(ALLOWLIST_PATH)) return new Set();
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error('io-bare-allowlist.json must be a JSON array of strings');
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
    `Wrote ${String(keys.length)} allowlist entries → tools/io-bare-allowlist.json`
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
      'Bare I/O check failed — use @pkgs/io (io.clock / io.timers / io.http / io.createId / io.random):\n'
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
      '\nStale allowlist entries (offense gone — remove from tools/io-bare-allowlist.json):\n'
    );
    for (const k of stale.slice(0, 100)) {
      console.error(`  - ${k}`);
    }
    if (stale.length > 100) {
      console.error(`  … and ${String(stale.length - 100)} more`);
    }
  }
  process.exit(1);
}

console.log(
  `Bare I/O check passed (${String(files.length)} files, ${String(offenses.length)} allowlisted offenses, ${String(allow.size)} allowlist entries).`
);
