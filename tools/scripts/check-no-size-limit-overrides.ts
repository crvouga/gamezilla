#!/usr/bin/env bun
/**
 * Fail-fast guardrail: app code never disables Tiger-Style structural caps.
 *
 * The size limits in root `biome.json` are load-bearing. If a function tripped
 * the cap, refactor it — do not punch a hole in the rule. The only legitimate
 * exemptions are the test / known-path `overrides` already wired into
 * `biome.json`. See AGENTS.md "Hard Rules".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const SCAN_ROOTS = ['apps', 'libs', 'pkgs', 'tools'] as const;

/** Biome rule names that encode the Tiger structural caps. */
const BANNED_BIOME_RULES = [
  'noExcessiveLinesPerFile',
  'noExcessiveLinesPerFunction',
  'useMaxParams',
  'noExcessiveNestedCallbacks',
  'noExcessiveCognitiveComplexity',
  'noExcessiveClassesPerFile',
] as const;

/** Allowed biome.json override includes (must stay in sync with biome.json). */
const ALLOWED_OVERRIDE_INCLUDES = new Set([
  '**/*.{test,spec}.{ts,tsx}',
  '**/__tests__/**',
  '**/__fixtures__/**',
  '**/testing/**',
  'apps/client/src/providers/app-providers.tsx',
  'libs/infra/src/cli/**/*.ts',
  'libs/stripe/scripts/**/*.ts',
  'libs/stripe/src/sync/**/*.ts',
  'pkgs/async/src/use-async.ts',
  'pkgs/chess-board/src/use-chess-game.ts',
  '**/scripts/**',
  '**/e2e/**',
  '**/*.bench.ts',
  '**/*.bench.tsx',
  'pkgs/logger/src/**',
  'pkgs/sql-cli/src/**',
  'pkgs/room-widgets/src/pages/use-room-sim.ts',
  'pkgs/chess-board/src/chess-board.tsx',
  // Non-size overrides (imports / naming) — still listed so the scanner stays exact-match.
  '**/pkgs/ui/src/components/icons/**',
  '**/src/components/icons/**',
  'apps/client/**',
]);

type Violation = { where: string; line: number; detail: string };

function walkTsFiles(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (
      name === 'node_modules' ||
      name === 'dist' ||
      name === '.expo' ||
      name === '.wrangler'
    ) {
      continue;
    }
    const p = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkTsFiles(p, out);
      continue;
    }
    const ext = extname(name);
    if (ext !== '.ts' && ext !== '.tsx' && ext !== '.js' && ext !== '.jsx') {
      continue;
    }
    if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue;
    if (name.endsWith('.spec.ts') || name.endsWith('.spec.tsx')) continue;
    out.push(p);
  }
}

function scanSourceFile(path: string): Violation[] {
  let src: string;
  try {
    src = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  if (!src.includes('biome-ignore') && !src.includes('eslint-disable')) {
    return [];
  }
  const violations: Violation[] = [];
  const lines = src.split('\n');
  for (const rule of BANNED_BIOME_RULES) {
    const biomePattern = new RegExp(
      `biome-ignore(?:\\s+(?:lint|assist)/[\\w/]+)?[^\\n]*\\b${rule}\\b`
    );
    const eslintPattern = new RegExp(
      `eslint-disable(?:-next-line|-line)?\\b[^\\n]*\\b${rule}\\b`
    );
    lines.forEach((line, idx) => {
      if (biomePattern.test(line) || eslintPattern.test(line)) {
        violations.push({
          where: relative(REPO_ROOT, path),
          line: idx + 1,
          detail: `inline suppress for ${rule}`,
        });
      }
    });
  }
  // Legacy eslint size-limit suppressions
  for (const legacy of [
    'max-lines',
    'max-lines-per-function',
    'max-params',
    'max-nested-callbacks',
    'complexity',
    'max-classes-per-file',
  ]) {
    const pattern = new RegExp(
      `eslint-disable(?:-next-line|-line)?\\b[^\\n]*\\b${legacy}\\b`
    );
    lines.forEach((line, idx) => {
      if (pattern.test(line)) {
        violations.push({
          where: relative(REPO_ROOT, path),
          line: idx + 1,
          detail: `legacy eslint-disable for ${legacy}`,
        });
      }
    });
  }
  return violations;
}

function scanBiomeJsonOverrides(): Violation[] {
  const path = join(REPO_ROOT, 'biome.json');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return [
      {
        where: 'biome.json',
        line: 1,
        detail: 'missing biome.json',
      },
    ];
  }
  const cfg = JSON.parse(raw) as {
    overrides?: Array<{
      includes?: string[];
      linter?: { rules?: Record<string, unknown> };
    }>;
  };
  const violations: Violation[] = [];
  for (const override of cfg.overrides ?? []) {
    const includes = override.includes ?? [];
    const allowed = includes.every((inc) => ALLOWED_OVERRIDE_INCLUDES.has(inc));
    if (!allowed) {
      // Only flag if this override turns off a banned size rule.
      const rulesJson = JSON.stringify(override.linter?.rules ?? {});
      const touchesSize = BANNED_BIOME_RULES.some((r) =>
        rulesJson.includes(`"${r}"`)
      );
      if (touchesSize) {
        violations.push({
          where: 'biome.json',
          line: 1,
          detail: `unapproved size-limit override includes: ${includes.join(', ')}`,
        });
      }
    }
  }
  return violations;
}

function findViolations(): Violation[] {
  const violations: Violation[] = [...scanBiomeJsonOverrides()];
  for (const rootName of SCAN_ROOTS) {
    const rootDir = join(REPO_ROOT, rootName);
    const files: string[] = [];
    walkTsFiles(rootDir, files);
    for (const f of files) violations.push(...scanSourceFile(f));
  }
  return violations;
}

const violations = findViolations();
if (violations.length === 0) {
  console.log('check:no-size-limit-overrides OK — no banned overrides found.');
  process.exit(0);
}

console.error(
  'check:no-size-limit-overrides FAILED — disabling Tiger-Style size limits is forbidden in app code.'
);
for (const v of violations) {
  console.error(`  - ${v.where}:${v.line}  ${v.detail}`);
}
console.error(
  '\nRefactor instead of disabling. Extract sub-components, helper hooks, or pure helpers. See AGENTS.md "Hard Rules".'
);
process.exit(1);
