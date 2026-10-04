/**
 * Reference rewriting for the naming codemod — pure, no I/O.
 *
 * Finds every occurrence of a renamed segment name in a file, grows it to the
 * enclosing path-like token (`../old_dir/clock`, `docs/old-doc.md`,
 * `@pkgs/x/shared/old_name`), resolves that token against the OLD tree the way
 * the consuming tool would (relative → package root → repo root, or a
 * workspace alias), and rewrites it to point at the NEW path in the same
 * style (extension / `index` omitted or not, `./` kept).
 *
 * Tokens that mention a renamed name but do not resolve fall back to a
 * segment-level heuristic only when the name is unambiguous and path-shaped;
 * everything else is reported for manual review — never guessed.
 */
import { posix } from 'node:path';

import type { RenamePlan } from './rename-plan';
import { mapPath } from './rename-plan';
import type { AliasRule } from './workspace-resolver';
import { resolveAlias, specifierFor } from './workspace-resolver';

const PROBE_SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.d.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '/index.ts',
  '/index.tsx',
  '/index.js',
] as const;

const TOKEN_CHAR = /[A-Za-z0-9_.\-/@~*\\]/;
const TRAILING_PUNCT = /[.,:;]+$/;

export interface RewriteContext {
  readonly plan: RenamePlan;
  /** Old-tree file paths. */
  readonly files: ReadonlySet<string>;
  /** Old-tree directory paths. */
  readonly dirs: ReadonlySet<string>;
  /** Directories holding a package.json (excluding the repo root). */
  readonly packageRoots: ReadonlySet<string>;
  readonly aliases: readonly AliasRule[];
  /** Old segment name → new, only when every occurrence in the tree maps the same way. */
  readonly uniqueNames: ReadonlyMap<string, string>;
  /** Old segment name → old path prefixes ending in that renamed segment. */
  readonly homes: ReadonlyMap<string, ReadonlySet<string>>;
  /** Every old segment name that changes. */
  readonly oldNames: ReadonlySet<string>;
  readonly needles: RegExp;
}

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly token: string;
  readonly replacement?: string;
}

export interface RewriteResult {
  readonly text: string;
  readonly edits: number;
  readonly heuristic: readonly Finding[];
  readonly manual: readonly Finding[];
}

const IMPORT_EXT = /\.(d\.ts|ts|tsx|js|jsx|mjs|cjs|json)$/;

/** Name an import specifier would use for a file (extension dropped for code). */
function importStem(name: string): string {
  return name.replace(IMPORT_EXT, '');
}

function addName(
  names: Map<string, Set<string>>,
  from: string,
  to: string
): void {
  if (from === to) return;
  const set = names.get(from) ?? new Set<string>();
  set.add(to);
  names.set(from, set);
}

interface RenamedNames {
  /** Whole segment name → every new name it takes (plus itself where it survives). */
  readonly segments: Map<string, Set<string>>;
  /** Whole segment name → old path prefixes ending in that renamed segment. */
  readonly homes: Map<string, Set<string>>;
  /** Extensionless code file names (`foo_bar` for `foo_bar.ts`). */
  readonly importStems: Set<string>;
}

function collectRenamedNames(plan: RenamePlan): RenamedNames {
  const out: RenamedNames = {
    segments: new Map(),
    homes: new Map(),
    importStems: new Set(),
  };
  for (const [from, to] of plan.files) {
    const a = from.split('/');
    const b = to.split('/');
    for (let i = 0; i < a.length; i += 1) {
      const name = a[i] ?? '';
      if (name === b[i]) continue;
      addName(out.segments, name, b[i] ?? '');
      const homes = out.homes.get(name) ?? new Set<string>();
      homes.add(a.slice(0, i + 1).join('/'));
      out.homes.set(name, homes);
    }
    const stem = importStem(a.at(-1) ?? '');
    if (stem !== a.at(-1)) out.importStems.add(stem);
  }
  return out;
}

function markUnchangedUses(
  paths: readonly string[],
  plan: RenamePlan,
  names: Map<string, Set<string>>
): void {
  for (const path of paths) {
    if (plan.files.has(path)) continue;
    for (const seg of path.split('/')) names.get(seg)?.add(seg);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dirsOf(paths: readonly string[]): Set<string> {
  const dirs = new Set<string>();
  for (const path of paths) {
    let i = path.lastIndexOf('/');
    while (i > 0) {
      const dir = path.slice(0, i);
      if (dirs.has(dir)) break;
      dirs.add(dir);
      i = dir.lastIndexOf('/');
    }
  }
  return dirs;
}

export function buildRewriteContext(
  plan: RenamePlan,
  paths: readonly string[],
  aliases: readonly AliasRule[]
): RewriteContext {
  const names = collectRenamedNames(plan);
  markUnchangedUses(paths, plan, names.segments);
  const uniqueNames = new Map<string, string>();
  for (const [from, tos] of names.segments) {
    const [only] = tos;
    if (tos.size === 1 && only !== undefined) uniqueNames.set(from, only);
  }
  const needles = new Set([...names.segments.keys(), ...names.importStems]);
  // Regex-shaped config (`llm\.md$` in .gitleaks.toml) spells dots escaped.
  for (const n of [...needles]) {
    if (n.includes('.')) needles.add(n.replaceAll('.', '\\.'));
  }
  const sorted = [...needles].sort((a, b) => b.length - a.length);
  const packageRoots = new Set(
    paths
      .filter((p) => p.endsWith('/package.json'))
      .map((p) => p.slice(0, -'/package.json'.length))
  );
  return {
    plan,
    files: new Set(paths),
    dirs: dirsOf(paths),
    packageRoots,
    aliases,
    uniqueNames,
    homes: names.homes,
    oldNames: new Set(names.segments.keys()),
    needles: new RegExp(sorted.map(escapeRegExp).join('|') || '(?!)', 'g'),
  };
}

function joinRel(dir: string, rel: string): string | null {
  const joined = posix.normalize(
    dir === '' || dir === '.' ? rel : `${dir}/${rel}`
  );
  if (joined.startsWith('../') || joined === '..') return null;
  return joined === '.' ? '' : joined.replace(/\/$/, '');
}

interface Probe {
  readonly old: string;
  /** Suffix the specifier omitted (`.ts`, `/index.ts`), '' when written in full. */
  readonly tail: string;
}

function probe(ctx: RewriteContext, path: string | null): Probe | null {
  if (path === null || path === '') return null;
  for (const suffix of PROBE_SUFFIXES) {
    if (ctx.files.has(`${path}${suffix}`))
      return { old: `${path}${suffix}`, tail: suffix };
  }
  return ctx.dirs.has(path) ? { old: path, tail: '' } : null;
}

function packageRootOf(ctx: RewriteContext, file: string): string | null {
  let dir = posix.dirname(file);
  while (dir !== '.' && dir !== '') {
    if (ctx.packageRoots.has(dir)) return dir;
    dir = posix.dirname(dir);
  }
  return null;
}

function newTargetOf(ctx: RewriteContext, hit: Probe): string | null {
  const moved = mapPath(ctx.plan, hit.old);
  if (!moved.endsWith(hit.tail)) return null;
  return moved.slice(0, moved.length - hit.tail.length);
}

function relativeSpec(
  fromDir: string,
  target: string,
  original: string
): string {
  const rel = posix.relative(fromDir === '' ? '.' : fromDir, target) || '.';
  return original.startsWith('./') && !rel.startsWith('.') ? `./${rel}` : rel;
}

function mapRuleTarget(ctx: RewriteContext, target: string): string {
  return target.endsWith('/')
    ? `${mapPath(ctx.plan, target.slice(0, -1))}/`
    : mapPath(ctx.plan, target);
}

function viaAlias(
  ctx: RewriteContext,
  core: string
): string | null | undefined {
  for (const hit of resolveAlias(ctx.aliases, core)) {
    const found = probe(ctx, hit.path);
    if (found === null) continue;
    const target = newTargetOf(ctx, found);
    if (target === null) return null;
    return specifierFor(hit.rule, mapRuleTarget(ctx, hit.rule.target), target);
  }
  return undefined;
}

/**
 * New spelling for a path core, `undefined` when it resolves nowhere,
 * `null` when it resolves but cannot be re-expressed.
 */
function rewriteCore(
  ctx: RewriteContext,
  file: string,
  core: string
): string | null | undefined {
  if (core.startsWith('@')) return viaAlias(ctx, core);
  const newFileDir = posix.dirname(mapPath(ctx.plan, file));
  const fileDir = posix.dirname(file);
  const relative = core.startsWith('./') || core.startsWith('../');
  if (core.startsWith('/')) {
    const hit = probe(ctx, joinRel('', core.slice(1)));
    const target = hit === null ? undefined : newTargetOf(ctx, hit);
    return target === undefined || target === null ? target : `/${target}`;
  }
  const pkg = relative ? null : packageRootOf(ctx, file);
  const bases: [string, string][] = [[fileDir, newFileDir]];
  if (pkg !== null) bases.push([pkg, mapPath(ctx.plan, pkg)]);
  if (!relative) bases.push(['', '']);
  for (const [oldBase, newBase] of bases) {
    const hit = probe(ctx, joinRel(oldBase, core));
    if (hit === null) continue;
    const target = newTargetOf(ctx, hit);
    if (target === null) return null;
    return newBase === '' && oldBase === ''
      ? target
      : relativeSpec(newBase, target, core);
  }
  return undefined;
}

type TokenOutcome =
  | { readonly kind: 'resolved' | 'heuristic'; readonly value: string }
  | { readonly kind: 'manual' | 'none' };

function isRealSegment(seg: string | undefined): seg is string {
  return seg !== undefined && seg !== '' && seg !== '.' && seg !== '..';
}

/**
 * Does the token's neighbourhood match a real renamed path? The segment before
 * must be that path's parent name, and the segment after must exist under it —
 * so `kenney_pack/Audio/x.ogg` (an external download) never matches an
 * in-repo `other/Audio/`.
 */
function matchesHome(
  ctx: RewriteContext,
  segs: readonly string[],
  k: number
): boolean {
  const name = segs[k] ?? '';
  const before = segs.slice(0, k).filter(isRealSegment).at(-1);
  const after = segs[k + 1];
  const checkAfter = isRealSegment(after) && !after.includes('*');
  for (const home of ctx.homes.get(name) ?? []) {
    const parent = home.includes('/')
      ? home.slice(0, home.lastIndexOf('/'))
      : '';
    const parentName = parent.slice(parent.lastIndexOf('/') + 1);
    if (before !== undefined && before !== parentName) continue;
    if (checkAfter && probe(ctx, `${home}/${after}`) === null) continue;
    return true;
  }
  return false;
}

/**
 * Unresolved token: rename a segment only when the token is unmistakably a
 * path to it — the token has a `/` (and its neighbouring segments match the
 * real renamed path), or the segment is a whole file name with an extension.
 * Bare words (`foo_bar` identifiers, `goal` in prose) are never touched and
 * not even reported.
 */
function heuristic(ctx: RewriteContext, token: string): TokenOutcome {
  const segs = token.split('/');
  const pathShaped = segs.length > 1;
  let changed = false;
  let mentions = false;
  const next = segs.map((seg, k) => {
    if (!ctx.oldNames.has(seg) || !(pathShaped || seg.includes('.'))) {
      return seg;
    }
    mentions = true;
    const to = ctx.uniqueNames.get(seg);
    if (to === undefined || !matchesHome(ctx, segs, k)) return seg;
    changed = true;
    return to;
  });
  if (changed) return { kind: 'heuristic', value: next.join('/') };
  return { kind: mentions ? 'manual' : 'none' };
}

/** Tokens written as regex source (`docs/llm\.md`) are resolved unescaped, then re-escaped. */
function rewriteToken(
  ctx: RewriteContext,
  file: string,
  token: string
): TokenOutcome {
  if (!token.includes('\\.')) return rewritePlainToken(ctx, file, token);
  const outcome = rewritePlainToken(ctx, file, token.replaceAll('\\.', '.'));
  return 'value' in outcome
    ? { ...outcome, value: outcome.value.replaceAll('.', '\\.') }
    : outcome;
}

function rewritePlainToken(
  ctx: RewriteContext,
  file: string,
  token: string
): TokenOutcome {
  if (token.startsWith('//')) return { kind: 'none' };
  const glob = token.indexOf('*');
  const cut = glob === -1 ? token.length : token.lastIndexOf('/', glob) + 1;
  const head = token.slice(0, cut);
  const tail = token.slice(cut);
  const slash = head.length > 1 && head.endsWith('/') ? '/' : '';
  const core = slash === '' ? head : head.slice(0, -1);
  const next = core === '' ? undefined : rewriteCore(ctx, file, core);
  if (next === undefined) return heuristic(ctx, token);
  if (next === null) return { kind: 'manual' };
  return { kind: 'resolved', value: `${next}${slash}${tail}` };
}

function tokenBounds(
  text: string,
  start: number,
  end: number
): [number, number] {
  let s = start;
  let e = end;
  while (s > 0 && TOKEN_CHAR.test(text[s - 1] ?? '')) s -= 1;
  while (e < text.length && TOKEN_CHAR.test(text[e] ?? '')) e += 1;
  const trimmed = text.slice(s, e).replace(TRAILING_PUNCT, '');
  return [s, s + Math.max(trimmed.length, end - s)];
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly value: string;
}

export function rewriteReferences(
  ctx: RewriteContext,
  file: string,
  text: string
): RewriteResult {
  const edits: Edit[] = [];
  const heuristicFindings: Finding[] = [];
  const manual: Finding[] = [];
  let consumed = 0;
  for (const match of text.matchAll(ctx.needles)) {
    const at = match.index ?? 0;
    if (at < consumed) continue;
    const [start, end] = tokenBounds(text, at, at + match[0].length);
    consumed = end;
    const token = text.slice(start, end);
    const outcome = rewriteToken(ctx, file, token);
    if (outcome.kind === 'manual')
      manual.push({ file, line: lineAt(text, start), token });
    if (outcome.kind !== 'resolved' && outcome.kind !== 'heuristic') continue;
    if (outcome.value === token) continue;
    edits.push({ start, end, value: outcome.value });
    if (outcome.kind === 'heuristic') {
      heuristicFindings.push({
        file,
        line: lineAt(text, start),
        token,
        replacement: outcome.value,
      });
    }
  }
  let out = text;
  for (const edit of [...edits].reverse()) {
    out = `${out.slice(0, edit.start)}${edit.value}${out.slice(edit.end)}`;
  }
  return {
    text: out,
    edits: edits.length,
    heuristic: heuristicFindings,
    manual,
  };
}
