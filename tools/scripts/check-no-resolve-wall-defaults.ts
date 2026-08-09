/**
 * Ban silent wall I/O fallbacks in product runtime.
 *
 * Production code must not call resolveNow()/resolveTimers()/resolveCreateId()/
 * resolveRandom()/resolveClock() with no argument. Wall adapters
 * (createGlobalHttpClient, wallIo, wallClock, …) are only allowed in test
 * files or files that opt in with `@io-wall-ok` (composition roots / wall
 * adapter modules). Zero-arg resolve* stays banned even in marked files.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { fileHasIoWallOkPragma } from './io-scan-pragma';
import { collectIoScanFiles, REPO_ROOT } from './io-scan-roots';

type Ban = {
  readonly kind: string;
  readonly re: RegExp;
  /**
   * When true, skipped in test files and in `@io-wall-ok` composition roots.
   * When false/undefined, banned everywhere (silent resolve* fallbacks).
   */
  readonly allowInWallOk?: boolean;
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
    allowInWallOk: true,
  },
  {
    kind: 'wallIo()',
    re: /\bwallIo\s*\(\s*\)/,
    allowInWallOk: true,
  },
  {
    kind: 'wallClock',
    re: /\bwallClock\b/,
    allowInWallOk: true,
  },
  {
    kind: 'wallTimers',
    re: /\bwallTimers\b/,
    allowInWallOk: true,
  },
  {
    kind: 'cryptoCreateId',
    re: /\bcryptoCreateId\b/,
    allowInWallOk: true,
  },
  {
    kind: 'mathRandom',
    re: /\bmathRandom\b/,
    allowInWallOk: true,
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
  const text = readFileSync(abs, 'utf8');
  const wallOk = fileHasIoWallOkPragma(text);
  const testFile = isTestFile(rel);
  const lines = text.split('\n');
  const out: Offense[] = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripLineComment(lines[i] ?? '');
    if (code.length === 0) continue;
    for (const ban of BANS) {
      if (ban.allowInWallOk === true && (wallOk || testFile)) continue;
      if (!ban.re.test(code)) continue;
      out.push({ path: rel, line: i + 1, kind: ban.kind });
    }
  }
  return out;
}

const files = collectIoScanFiles();
const offenses: Offense[] = [];
for (const f of files) {
  offenses.push(...scanFile(f));
}

if (offenses.length > 0) {
  console.error(
    'Silent wall-I/O fallback check failed — inject Io via constructor or React context (useIo / getIo).\n' +
      'Composition roots / wall adapters may use wallIo/wallClock/… when marked with `// @io-wall-ok`.\n' +
      'Zero-arg resolve*() is never allowed:\n'
  );
  for (const o of offenses.slice(0, 200)) {
    console.error(`  - ${offenseKey(o)}`);
  }
  if (offenses.length > 200) {
    console.error(`  … and ${String(offenses.length - 200)} more`);
  }
  process.exit(1);
}

console.log(
  `No-resolve-wall-defaults check passed (${String(files.length)} files).`
);
