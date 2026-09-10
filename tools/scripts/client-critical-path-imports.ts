#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Walk static imports from apps/client/src/main.tsx and fail if the closure
 * hits modules that must stay off the low-end Android critical path.
 * Also flags top-level import() and denylisted eager dynamic imports.
 *
 * usage: client-critical-path-imports.ts [--budget=<perf-budget.json>]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import {
  type GateMode,
  loadPerfBudget,
  parseBudgetPath,
  reportGate,
} from './perf-budget';

const REPO_ROOT = join(import.meta.dirname, '../..');
const ENTRY_REL = 'apps/client/src/main.tsx';
const TSCONFIG_REL = 'tsconfig.base.json';
const DEFAULT_BUDGET = join(REPO_ROOT, 'apps/client/perf-budget.json');

const DENY_SPECIFIER_PREFIXES = [
  '@libs/chess',
  '@libs/games/game-plugins.client',
  '@pkgs/sim-console',
  '@sqlite.org/sqlite-wasm',
] as const;

const STATIC_FROM =
  /(?:^|[;\n])\s*(?:export|import)\s+(?!type\b)(?:[\s\S]*?\s+from\s+|[\s]*)['"]([^'"]+)['"]/g;

const SIDE_EFFECT_IMPORT = /(?:^|[;\n])\s*import\s+['"]([^'"]+)['"]/g;

const DYNAMIC_IMPORT_RE =
  /\bimport\s*\(\s*(?:'([^']+)'|"([^"]+)"|`([^`$]*)`)\s*\)/g;

export type PathAlias = {
  readonly pattern: string;
  readonly targets: string[];
};

export type DynamicImportHit = {
  readonly specifier: string;
  readonly line: number;
  readonly topLevel: boolean;
};

export function loadPathAliases(tsconfigAbs: string): PathAlias[] {
  const raw = JSON.parse(readFileSync(tsconfigAbs, 'utf8')) as {
    compilerOptions?: { paths?: Record<string, string[]> };
  };
  const paths = raw.compilerOptions?.paths ?? {};
  const aliases: PathAlias[] = [];
  for (const [pattern, targets] of Object.entries(paths)) {
    aliases.push({
      pattern,
      targets: targets.map((t) => t.replace(/^\.\//, '')),
    });
  }
  aliases.sort((a, b) => b.pattern.length - a.pattern.length);
  return aliases;
}

export function isDeniedSpecifier(specifier: string): boolean {
  for (const prefix of DENY_SPECIFIER_PREFIXES) {
    if (specifier === prefix || specifier.startsWith(`${prefix}/`)) return true;
  }
  return specifier.includes('sql-workers');
}

export function isDeniedResolvedPath(absPath: string): boolean {
  const norm = absPath.split('\\').join('/');
  return (
    norm.includes('/sql-workers/') ||
    norm.includes('/libs/chess/') ||
    norm.includes('game-plugins.client') ||
    norm.includes('/pkgs/sim-console/') ||
    norm.includes('sqlite-wasm')
  );
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export function collectStaticSpecifiers(source: string): string[] {
  const text = stripComments(source);
  const out = new Set<string>();
  for (const re of [STATIC_FROM, SIDE_EFFECT_IMPORT]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const spec = m[1];
      if (spec === undefined || spec.length === 0) continue;
      out.add(spec);
    }
  }
  return [...out];
}

/** Rough brace depth + filters for typeof / type-position / arrow bodies. */
export function collectDynamicImports(source: string): DynamicImportHit[] {
  const text = stripComments(source);
  const hits: DynamicImportHit[] = [];
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{' || ch === '(' || ch === '[') depth += 1;
    if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (
      text.startsWith('import', i) &&
      (i === 0 || !/\w/.test(text[i - 1] ?? ''))
    ) {
      DYNAMIC_IMPORT_RE.lastIndex = i;
      const m = DYNAMIC_IMPORT_RE.exec(text);
      if (m !== null && m.index === i) {
        const specifier = m[1] ?? m[2] ?? m[3] ?? '';
        const before = text.slice(0, m.index);
        const after = text.slice(m.index + m[0].length);
        const skipTypeof = /\btypeof\s*$/.test(before);
        const skipTypePos = /[:|&<]\s*$/.test(before);
        const skipImportTypeProp = /^\s*\)\s*\./.test(after);
        if (
          specifier.length > 0 &&
          !skipTypeof &&
          !skipTypePos &&
          !skipImportTypeProp
        ) {
          // Map stripped index → original line via unique nearby snippet.
          const snippet = text.slice(m.index, m.index + m[0].length);
          const origIdx = source.indexOf(snippet);
          const line =
            origIdx >= 0
              ? source.slice(0, origIdx).split('\n').length
              : before.split('\n').length;
          const arrowBody = /=>\s*$/.test(before);
          hits.push({
            specifier,
            line,
            topLevel: depth === 0 && !arrowBody,
          });
        }
        i = DYNAMIC_IMPORT_RE.lastIndex;
        continue;
      }
    }
    i += 1;
  }
  return hits;
}

function tryFile(absNoExt: string): string | undefined {
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']) {
    const candidate = `${absNoExt}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const candidate = join(absNoExt, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function resolveImport(args: {
  readonly specifier: string;
  readonly fromFile: string;
  readonly repoRoot: string;
  readonly aliases: readonly PathAlias[];
}): string | undefined {
  const { specifier, fromFile, repoRoot, aliases } = args;
  if (specifier.startsWith('.')) {
    return tryFile(resolve(dirname(fromFile), specifier));
  }
  for (const alias of aliases) {
    if (alias.pattern.endsWith('/*')) {
      const head = alias.pattern.slice(0, -2);
      if (specifier !== head && !specifier.startsWith(`${head}/`)) continue;
      const rest = specifier === head ? '' : specifier.slice(head.length + 1);
      for (const target of alias.targets) {
        const targetHead = target.endsWith('/*')
          ? target.slice(0, -2)
          : target.replace(/\/\*$/, '').replace(/\*$/, '');
        const mapped = rest.length === 0 ? targetHead : join(targetHead, rest);
        const hit = tryFile(join(repoRoot, mapped));
        if (hit !== undefined) return hit;
      }
      continue;
    }
    if (specifier !== alias.pattern) continue;
    for (const target of alias.targets) {
      const cleaned = target.replace(/\*$/, '');
      const abs = join(repoRoot, cleaned);
      const hit = tryFile(abs);
      if (hit !== undefined) return hit;
      if (existsSync(abs)) return abs;
    }
  }
  return undefined;
}

export type CriticalPathViolation = {
  readonly fromRel: string;
  readonly specifier: string;
  readonly reason: string;
  readonly soft?: boolean;
};

export function walkCriticalPath(args: {
  readonly entryAbs: string;
  readonly repoRoot: string;
  readonly aliases: readonly PathAlias[];
}): { readonly files: string[]; readonly violations: CriticalPathViolation[] } {
  const seen = new Set<string>();
  const queue = [args.entryAbs];
  const violations: CriticalPathViolation[] = [];
  const files: string[] = [];

  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    files.push(file);

    if (!existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const specifier of collectStaticSpecifiers(source)) {
      if (isDeniedSpecifier(specifier)) {
        violations.push({
          fromRel: relative(args.repoRoot, file),
          specifier,
          reason: 'specifier is on the critical-path denylist',
        });
        continue;
      }
      if (
        !specifier.startsWith('.') &&
        !specifier.startsWith('@libs/') &&
        !specifier.startsWith('@pkgs/') &&
        !specifier.startsWith('@apps/')
      ) {
        continue;
      }
      const resolved = resolveImport({
        specifier,
        fromFile: file,
        repoRoot: args.repoRoot,
        aliases: args.aliases,
      });
      if (resolved === undefined) continue;
      if (isDeniedResolvedPath(resolved)) {
        violations.push({
          fromRel: relative(args.repoRoot, file),
          specifier,
          reason: 'resolved module is on the critical-path denylist',
        });
        continue;
      }
      queue.push(resolved);
    }
  }

  return { files, violations };
}

export function scanEagerDynamicImports(args: {
  readonly files: readonly string[];
  readonly repoRoot: string;
}): CriticalPathViolation[] {
  const violations: CriticalPathViolation[] = [];
  for (const file of args.files) {
    if (!existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    const fromRel = relative(args.repoRoot, file);
    for (const hit of collectDynamicImports(source)) {
      if (hit.topLevel) {
        violations.push({
          fromRel: `${fromRel}:${String(hit.line)}`,
          specifier: hit.specifier,
          reason:
            'top-level import() on the initial static closure — defer behind a function or route',
        });
      }
      if (isDeniedSpecifier(hit.specifier)) {
        violations.push({
          fromRel: `${fromRel}:${String(hit.line)}`,
          specifier: hit.specifier,
          reason:
            'eager dynamic import of denylisted module — moves cost onto first load; defer behind user gesture or route',
          soft: true,
        });
      }
    }
  }
  return violations;
}

function main(): void {
  const argv = process.argv.slice(2);
  let budgetPath = DEFAULT_BUDGET;
  try {
    if (argv.some((a) => a.startsWith('--budget='))) {
      const p = parseBudgetPath(argv);
      budgetPath = p.startsWith('/') ? p : join(process.cwd(), p);
    }
  } catch {
    // optional flag
  }
  const budget = loadPerfBudget(budgetPath);
  const mode: GateMode = budget.criticalPath.eagerDynamicImportMode;

  const entryAbs = join(REPO_ROOT, ENTRY_REL);
  if (!existsSync(entryAbs)) {
    console.error(`[critical-path] missing entry ${ENTRY_REL}`);
    process.exit(1);
  }
  const aliases = loadPathAliases(join(REPO_ROOT, TSCONFIG_REL));
  const { files, violations } = walkCriticalPath({
    entryAbs,
    repoRoot: REPO_ROOT,
    aliases,
  });
  const dynamicViolations = scanEagerDynamicImports({
    files,
    repoRoot: REPO_ROOT,
  });

  console.log(
    `[critical-path] walked ${String(files.length)} files from ${ENTRY_REL}`
  );

  let failed = false;
  const hard = [
    ...violations,
    ...dynamicViolations.filter((v) => v.soft !== true),
  ];
  const soft = dynamicViolations.filter((v) => v.soft === true);

  if (hard.length > 0) {
    failed = true;
    console.error(
      `[critical-path] ${String(hard.length)} denylist hit(s) — low-end Android critical path`
    );
    for (const v of hard) {
      console.error(`  ${v.fromRel} → ${v.specifier} (${v.reason})`);
    }
  }

  for (const v of soft) {
    const result = reportGate({
      tag: 'critical-path',
      mode,
      over: true,
      message: `eager dynamic import of ${v.specifier} at ${v.fromRel} (mode=${mode}) — ${v.reason}`,
    });
    if (result === 'fail') failed = true;
  }

  if (hard.length === 0 && soft.length === 0) {
    console.log('[critical-path] OK');
  }
  if (failed) process.exit(1);
}

if (import.meta.main) main();
