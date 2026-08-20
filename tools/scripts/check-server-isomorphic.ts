#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Pit of success: `@apps/server` Hono/runtime source is isomorphic by default.
 *
 * Node-only / engine deps are allowed only in `@api-wall-ok` modules (injected
 * adapters + composition roots). Isomorphic files must not import those wall
 * modules — ports stay as types / constructor params.
 *
 *   bun run ci:server-isomorphic
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const SERVER_SRC = join(REPO_ROOT, 'apps', 'server', 'src');
const SKIP_DIR = new Set(['node_modules', 'dist', '.turbo', 'coverage']);

const API_WALL_PRAGMA =
  /^\s*(?:\/\/|\*|\/\*\*?)\s*@api-wall-ok\b|^\s*@api-wall-ok\b/;

const FORBIDDEN_SPECIFIERS = new Set([
  'pg',
  'better-sqlite3',
  'async_hooks',
  'fs',
  'path',
  'url',
  'os',
  'net',
  'tls',
  'http',
  'https',
  'http2',
  'stream',
  'crypto',
  'child_process',
  'worker_threads',
  'cluster',
  'dns',
  'zlib',
  'buffer',
  'util',
  'events',
  'module',
  'assert',
  'vm',
  'readline',
  'tty',
  'dgram',
]);

const IMPORT_RE = /(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;

type Violation = {
  readonly file: string;
  readonly kind: 'forbidden-import' | 'imports-wall';
  readonly detail: string;
};

function fileHasApiWallOk(text: string): boolean {
  for (const line of text.split('\n')) {
    if (API_WALL_PRAGMA.test(line)) return true;
  }
  return false;
}

function walk(dir: string, files: string[]): void {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (SKIP_DIR.has(name)) continue;
      walk(abs, files);
      continue;
    }
    if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      files.push(abs);
    }
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function collectImports(source: string): string[] {
  const cleaned = stripComments(source);
  const out: string[] = [];
  for (const match of cleaned.matchAll(IMPORT_RE)) {
    const spec = match[1];
    if (spec != null) out.push(spec);
  }
  return out;
}

function isForbiddenSpecifier(spec: string): boolean {
  if (spec.startsWith('node:')) return true;
  if (spec.startsWith('cloudflare:')) return true;
  const base = spec.split('/')[0] ?? spec;
  return FORBIDDEN_SPECIFIERS.has(base);
}

/** Resolve relative import within apps/server/src to an absolute .ts path. */
function resolveLocalImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = join(fromFile, '..', spec);
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    base,
  ];
  for (const c of candidates) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      // try next
    }
  }
  return null;
}

function main(): void {
  const files: string[] = [];
  walk(SERVER_SRC, files);

  const wallFiles = new Set<string>();
  const contents = new Map<string, string>();
  for (const abs of files) {
    const text = readFileSync(abs, 'utf8');
    contents.set(abs, text);
    if (fileHasApiWallOk(text)) wallFiles.add(abs);
  }

  const violations: Violation[] = [];

  for (const abs of files) {
    const text = contents.get(abs)!;
    const rel = relative(REPO_ROOT, abs);
    const isWall = wallFiles.has(abs);
    const imports = collectImports(text);

    if (!isWall) {
      for (const spec of imports) {
        if (isForbiddenSpecifier(spec)) {
          violations.push({
            file: rel,
            kind: 'forbidden-import',
            detail: spec,
          });
        }
      }
    }

    // Edge discipline: isomorphic must not import @api-wall-ok modules.
    if (!isWall) {
      for (const spec of imports) {
        const resolved = resolveLocalImport(abs, spec);
        if (resolved != null && wallFiles.has(resolved)) {
          violations.push({
            file: rel,
            kind: 'imports-wall',
            detail: `${spec} → ${relative(REPO_ROOT, resolved)}`,
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log(
      `ci:server-isomorphic OK — ${String(files.length)} files, ${String(wallFiles.size)} @api-wall-ok`
    );
    return;
  }

  console.error('ci:server-isomorphic FAILED\n');
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.kind} (${v.detail})`);
  }
  console.error(
    `\n${String(violations.length)} violation(s). Keep Hono/runtime isomorphic; put Node engines behind @api-wall-ok injectors and never import them from isomorphic code.`
  );
  process.exit(1);
}

main();
