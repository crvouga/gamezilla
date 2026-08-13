// @io-wall-ok — tools composition root
/**
 * Extremely strict bare-I/O gate for product runtime.
 *
 * Ban Date.now / performance.now / zero-arg new Date / timers / fetch /
 * crypto.randomUUID / Math.random / crypto.getRandomValues outside wall
 * adapters. Wall adapter modules and polyfills opt in with `@io-wall-ok`.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { fileAllowsWallConstruction, fileHasIoWallOkPragma } from './io-scan-pragma';
import { collectIoScanFiles, REPO_ROOT } from './io-scan-roots';

type Ban = {
  readonly kind: string;
  readonly re: RegExp;
};

const BANS: readonly Ban[] = [
  // Call forms and bare identifier refs (e.g. `now ?? Date.now`, `= Math.random`).
  { kind: 'Date.now', re: /\bDate\.now\b/ },
  { kind: 'performance.now', re: /\bperformance\.now\b/ },
  { kind: 'new Date()', re: /\bnew\s+Date\s*\(\s*\)/ },
  { kind: 'setTimeout', re: /(?:^|[^\w.])setTimeout\s*\(/ },
  { kind: 'clearTimeout', re: /(?:^|[^\w.])clearTimeout\s*\(/ },
  { kind: 'setInterval', re: /(?:^|[^\w.])setInterval\s*\(/ },
  { kind: 'clearInterval', re: /(?:^|[^\w.])clearInterval\s*\(/ },
  {
    kind: 'qualified setTimeout',
    re: /\b(?:globalThis|self|window)\.setTimeout\s*\(/,
  },
  {
    kind: 'qualified setInterval',
    re: /\b(?:globalThis|self|window)\.setInterval\s*\(/,
  },
  {
    kind: 'qualified clearTimeout',
    re: /\b(?:globalThis|self|window)\.clearTimeout\s*\(/,
  },
  {
    kind: 'qualified clearInterval',
    re: /\b(?:globalThis|self|window)\.clearInterval\s*\(/,
  },
  { kind: 'bare fetch', re: /(?:^|[^.\w])fetch\s*\(/ },
  { kind: 'globalThis.fetch', re: /globalThis\.fetch/ },
  { kind: 'crypto.randomUUID', re: /crypto\.randomUUID\b/ },
  { kind: 'Math.random', re: /\bMath\.random\b/ },
  { kind: 'crypto.getRandomValues', re: /crypto\.getRandomValues\b/ },
  { kind: 'imported randomUUID(', re: /(?<![\w.])randomUUID\s*\(/ },
  { kind: 'imported randomBytes(', re: /(?<![\w.])randomBytes\s*\(/ },
];

type Offense = {
  readonly path: string;
  readonly line: number;
  readonly kind: string;
};

function offenseKey(o: Offense): string {
  return `${o.path}:${String(o.line)}:${o.kind}`;
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
  // Tooling / meta-checkers embed ban patterns as string literals.
  if (rel.startsWith('tools/')) return [];
  // Built / copied worker bundles — sources are scanned separately.
  if (rel.includes('/public/')) return [];
  if (rel.includes('/e2e/public/')) return [];
  const text = readFileSync(abs, 'utf8');
  if (fileAllowsWallConstruction(rel, text)) return [];
  // Test files may use wall I/O; product reduce paths are covered by non-test scans.
  if (
    /\.(test|spec|sim\.test)\.[tj]sx?$/.test(rel) ||
    /\/(__tests__|testing|testkit)\//.test(rel)
  ) {
    return [];
  }
  // Top-level test/ harnesses are simulation composition roots — allow wall via pragma only.
  if (rel.startsWith('test/') && fileHasIoWallOkPragma(text)) return [];
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

const files = await collectIoScanFiles();
const offenses: Offense[] = [];
for (const f of files) {
  offenses.push(...scanFile(f));
}

if (offenses.length > 0) {
  console.error(
    'Bare I/O check failed — use @pkgs/io (io.clock / io.timers / io.http / io.createId / io.random).\n' +
      'Wall adapters / polyfills must be entry-shaped and mark `// @io-wall-ok`:\n'
  );
  for (const o of offenses.slice(0, 200)) {
    console.error(`  - ${offenseKey(o)}`);
  }
  if (offenses.length > 200) {
    console.error(`  … and ${String(offenses.length - 200)} more`);
  }
  process.exit(1);
}

console.log(`Bare I/O check passed (${String(files.length)} files).`);

