#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Naming codemod: renames every path that breaks the naming convention
 * (`libs/tools-harness-ts/naming/naming-rules.ts`) and rewrites everything that points at
 * it — relative / workspace-alias imports, `new URL(...)` assets, package.json
 * scripts, turbo / biome config paths, and Markdown links.
 *
 *   bun run naming:fix                     # dry run: plan + edits, nothing touched
 *   bun run naming:fix --write             # apply
 *   bun run naming:fix --write pkgs/foo    # only rename under these prefixes
 *
 * References are resolved against the OLD tree, rewritten in place, then the
 * files move (two-phase through a staging dir so case-only renames work on
 * case-insensitive filesystems). Import order is re-sorted with Biome and the
 * naming gate re-runs at the end.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

import type { RenamePlan } from '../naming/rename-plan';
import { planRenames } from '../naming/rename-plan';
import type { Finding, RewriteContext } from '../naming/rewrite-references';
import {
  buildRewriteContext,
  rewriteReferences,
} from '../naming/rewrite-references';
import type {
  AliasRule,
  WorkspaceManifest,
} from '../naming/workspace-resolver';
import {
  rulesFromManifests,
  rulesFromTsconfigPaths,
} from '../naming/workspace-resolver';

const ROOT = join(import.meta.dirname, '../../..');
const STAGING = '.naming-fix-staging';
const MAX_TEXT_BYTES = 4 * 1024 * 1024;
const BIOME_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|json|jsonc|css)$/;

const args = process.argv.slice(2);
const write = args.includes('--write');
const prefixes = args
  .filter((a) => !a.startsWith('--'))
  .map((a) => a.replace(/^\.\//, ''));

function git(gitArgs: string[]): string {
  return execFileSync('git', gitArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function listPaths(extra: string[]): string[] {
  return git(['ls-files', '-z', ...extra])
    .split('\0')
    .filter((p) => p.length > 0);
}

function readJson(path: string): unknown {
  try {
    return Bun.JSONC.parse(readFileSync(join(ROOT, path), 'utf8'));
  } catch {
    return undefined;
  }
}

function loadAliases(paths: readonly string[]): AliasRule[] {
  const rules: AliasRule[] = [];
  for (const tsconfig of ['tsconfig.base.json', 'tsconfig.json']) {
    const json = readJson(tsconfig) as {
      compilerOptions?: { paths?: Record<string, unknown> };
    };
    rules.push(...rulesFromTsconfigPaths(json?.compilerOptions?.paths ?? {}));
  }
  const manifests: WorkspaceManifest[] = [];
  for (const path of paths) {
    if (!path.endsWith('/package.json') || path.includes('node_modules/'))
      continue;
    const json = readJson(path) as
      | { name?: string; exports?: unknown }
      | undefined;
    if (json === undefined) continue;
    manifests.push({
      dir: dirname(path),
      name: json.name,
      exports: json.exports,
    });
  }
  return [...rules, ...rulesFromManifests(manifests)];
}

function readText(path: string): string | null {
  const abs = join(ROOT, path);
  try {
    if (statSync(abs).size > MAX_TEXT_BYTES) return null;
    const buf = readFileSync(abs);
    return buf.subarray(0, 8000).includes(0) ? null : buf.toString('utf8');
  } catch {
    return null;
  }
}

interface Rewrites {
  readonly texts: Map<string, string>;
  readonly counts: Map<string, number>;
  readonly heuristic: Finding[];
  readonly manual: Finding[];
}

function computeRewrites(
  ctx: RewriteContext,
  paths: readonly string[]
): Rewrites {
  const out: Rewrites = {
    texts: new Map(),
    counts: new Map(),
    heuristic: [],
    manual: [],
  };
  for (const path of paths) {
    const text = readText(path);
    if (text === null || text.search(ctx.needles) === -1) continue;
    const result = rewriteReferences(ctx, path, text);
    out.heuristic.push(...result.heuristic);
    out.manual.push(...result.manual);
    if (result.edits === 0) continue;
    out.texts.set(path, result.text);
    out.counts.set(path, result.edits);
  }
  return out;
}

/** Top-most renamed directories, then every file whose own name changes. */
function summarizeRenames(plan: RenamePlan): string[] {
  const lines: string[] = [];
  const topDirs = [...plan.dirs.keys()].filter((d) => {
    const parent = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : '';
    return !plan.dirs.has(parent);
  });
  for (const dir of topDirs.sort())
    lines.push(`  dir   ${dir}/  →  ${plan.dirs.get(dir)}/`);
  for (const [from, to] of plan.files) {
    if (basename(from) === basename(to)) continue;
    lines.push(`  file  ${from}  →  ${to}`);
  }
  return lines;
}

function formatFinding(f: Finding): string {
  const arrow = f.replacement === undefined ? '' : `  →  ${f.replacement}`;
  return `  ${f.file}:${f.line}  ${f.token}${arrow}`;
}

const MANUAL_PER_FILE = 5;

/** Manual findings, at most {@link MANUAL_PER_FILE} per file plus a count of the rest. */
function capPerFile(findings: readonly Finding[]): string[] {
  const byFile = new Map<string, Finding[]>();
  for (const f of findings)
    byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  const lines: string[] = [];
  for (const [file, list] of byFile) {
    lines.push(...list.slice(0, MANUAL_PER_FILE).map(formatFinding));
    const rest = list.length - MANUAL_PER_FILE;
    if (rest > 0) lines.push(`  ${file}  … +${rest} more`);
  }
  return lines;
}

function report(plan: RenamePlan, rewrites: Rewrites): void {
  console.log(`[naming:fix] ${plan.files.size} file path(s) to rename:`);
  console.log(summarizeRenames(plan).join('\n'));
  console.log(
    `\n[naming:fix] ${rewrites.counts.size} file(s) with reference edits:`
  );
  for (const [file, n] of [...rewrites.counts].sort())
    console.log(`  ${file}  (${n})`);
  if (rewrites.heuristic.length > 0) {
    console.log(
      '\n[naming:fix] heuristic edits (name-only match, review these):'
    );
    console.log(rewrites.heuristic.map(formatFinding).join('\n'));
  }
  if (rewrites.manual.length > 0) {
    console.log(
      '\n[naming:fix] needs manual review (mentions a renamed name, did not resolve):'
    );
    console.log(capPerFile(rewrites.manual).join('\n'));
  }
}

function pruneEmptyDirs(dirs: Iterable<string>): void {
  const deepestFirst = [...dirs].sort(
    (a, b) => b.split('/').length - a.split('/').length
  );
  for (const dir of deepestFirst) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    rmSync(join(abs, '.DS_Store'), { force: true });
    if (readdirSync(abs).length === 0) rmdirSync(abs);
  }
}

function move(from: string, to: string): void {
  const dest = join(ROOT, to);
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(join(ROOT, from), dest);
}

function inChunks(
  items: readonly string[],
  run: (chunk: string[]) => void
): void {
  for (let i = 0; i < items.length; i += 500) run(items.slice(i, i + 500));
}

/** Two-phase move through a staging dir, then mirror it in the git index. */
function applyMoves(plan: RenamePlan, tracked: ReadonlySet<string>): void {
  if (existsSync(join(ROOT, STAGING)))
    throw new Error(`${STAGING} already exists — remove it first`);
  const entries = [...plan.files].filter(([from]) =>
    existsSync(join(ROOT, from))
  );
  for (const [from, to] of entries) move(from, `${STAGING}/${to}`);
  pruneEmptyDirs([...plan.dirs.keys()]);
  for (const [, to] of entries) move(`${STAGING}/${to}`, to);
  rmSync(join(ROOT, STAGING), { recursive: true, force: true });
  const moved = entries.filter(([from]) => tracked.has(from));
  inChunks(
    moved.map(([from]) => from),
    (chunk) => git(['rm', '--cached', '-q', '--', ...chunk])
  );
  inChunks(
    moved.map(([, to]) => to),
    (chunk) => git(['add', '--', ...chunk])
  );
}

function apply(
  plan: RenamePlan,
  rewrites: Rewrites,
  tracked: ReadonlySet<string>
): void {
  for (const [path, text] of rewrites.texts)
    writeFileSync(join(ROOT, path), text);
  applyMoves(plan, tracked);
  const touched = new Set<string>();
  for (const path of rewrites.texts.keys())
    touched.add(plan.files.get(path) ?? path);
  for (const to of plan.files.values()) touched.add(to);
  const biomeFiles = [...touched].filter(
    (p) => BIOME_EXT.test(p) && existsSync(join(ROOT, p))
  );
  if (biomeFiles.length > 0) {
    spawnSync(
      'bunx',
      [
        'biome',
        'check',
        '--write',
        '--no-errors-on-unmatched',
        '--files-ignore-unknown=true',
        ...biomeFiles,
      ],
      { cwd: ROOT, stdio: 'inherit' }
    );
  }
  const gate = spawnSync(
    'bun',
    ['run', 'libs/tools-harness-ts/scripts/verify-naming.ts'],
    {
      cwd: ROOT,
      stdio: 'inherit',
    }
  );
  console.log(
    gate.status === 0
      ? '\n[naming:fix] done — naming gate passes.'
      : '\n[naming:fix] naming gate still failing (see above).'
  );
}

const paths = listPaths(['--cached', '--others', '--exclude-standard']);
const plan = planRenames(paths, prefixes);

if (plan.files.size === 0) {
  console.log(
    '[naming:fix] nothing to rename — every path follows the convention.'
  );
  process.exit(0);
}
if (plan.collisions.length > 0) {
  console.error(
    `[naming:fix] refusing to rename — collisions:\n  ${plan.collisions.join('\n  ')}`
  );
  process.exit(1);
}

const ctx = buildRewriteContext(plan, paths, loadAliases(paths));
const rewrites = computeRewrites(ctx, paths);
report(plan, rewrites);

if (write) {
  apply(plan, rewrites, new Set(listPaths(['--cached'])));
} else {
  console.log('\n[naming:fix] dry run — re-run with --write to apply.');
}
