// @io-wall-ok — tools composition root
/**
 * Ban wall filesystem imports outside ObjectStore wall adapters.
 *
 * Libraries, CLIs, and CI scripts must use {@link ObjectStore} (tree or sidecar
 * layout). Only entry-shaped `@io-wall-ok` wall adapters may import `node:fs`,
 * `Bun.file` / `Bun.Glob`, or `expo-file-system`.
 *
 * Process I/O (`child_process`, `chmod`, spawn) is out of scope — see DETERMINISM.md.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { fileAllowsWallConstruction } from './io-scan-pragma';
import { collectIoScanFiles, REPO_ROOT } from './io-scan-roots';

type Ban = {
  readonly kind: string;
  readonly re: RegExp;
};

const BANS: readonly Ban[] = [
  {
    kind: "from 'node:fs'",
    re: /from\s+['"]node:fs(?:\/promises)?['"]/,
  },
  {
    kind: "from 'fs'",
    re: /from\s+['"]fs(?:\/promises)?['"]/,
  },
  {
    kind: "require('fs')",
    re: /require\s*\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\)/,
  },
  { kind: 'Bun.file', re: /\bBun\.file\b/ },
  { kind: 'Bun.write', re: /\bBun\.write\b/ },
  { kind: 'Bun.Glob', re: /\bBun\.Glob\b/ },
  { kind: 'new Glob(', re: /\bnew\s+Glob\s*\(/ },
  {
    kind: "from 'expo-file-system'",
    re: /from\s+['"]expo-file-system['"]/,
  },
  { kind: 'fs.watch', re: /\bfs\.watch\b|\bwatch\s*\(\s*[^)]*recursive/ },
];

/** Wall adapter basenames that may import node:fs / expo-file-system. */
const WALL_FS_BASENAMES = new Set([
  'wall-node-fs.ts',
  'wall-expo-fs.ts',
  'wall-path-exists.ts',
  'wall-os-fs.ts',
  'repo-tree-store.ts',
]);

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
    /\.(test|spec|sim\.test)\.[tj]sx?$/.test(rel) ||
    /^(?:test|tests)\//.test(rel) ||
    /\/(test|tests|testing|testkit|__tests__)\//.test(rel)
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

function isWallFsAdapter(rel: string): boolean {
  const base = rel.split('/').pop() ?? '';
  return WALL_FS_BASENAMES.has(base);
}

function scanFile(abs: string): Offense[] {
  const rel = relative(REPO_ROOT, abs);
  const text = readFileSync(abs, 'utf8');
  if (isWallFsAdapter(rel) && fileAllowsWallConstruction(rel, text)) {
    return [];
  }
  if (isTestFile(rel)) return [];
  // Composition-root scripts / CLI / tools with @io-wall-ok may still touch wall
  // fs while migrating; product libraries must be clean.
  if (fileAllowsWallConstruction(rel, text)) {
    return [];
  }
  const lines = text.split('\n');
  const out: Offense[] = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripLineComment(lines[i] ?? '');
    if (code.length === 0) continue;
    for (const ban of BANS) {
      if (!ban.re.test(code)) continue;
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
    'Bare FS check failed — use @pkgs/object-store (injected ObjectStore).\n' +
      'Wall adapters only: wall-node-fs.ts / wall-expo-fs.ts with `@io-wall-ok`:\n'
  );
  for (const o of offenses.slice(0, 200)) {
    console.error(`  - ${offenseKey(o)}`);
  }
  if (offenses.length > 200) {
    console.error(`  … and ${String(offenses.length - 200)} more`);
  }
  process.exit(1);
}

console.log(`Bare FS check passed (${String(files.length)} files).`);
