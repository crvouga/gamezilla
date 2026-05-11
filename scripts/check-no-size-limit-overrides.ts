#!/usr/bin/env bun
/**
 * Fail-fast guardrail: app code never disables Tiger-Style structural caps.
 *
 * The size limits in `packages/eslint-rules/size-limits.cjs` are load-bearing.
 * If a function tripped the cap, refactor it — do not punch a hole in the rule.
 * The only legitimate exemption is `testOverrides()`, already wired into the
 * shared base config. See AGENTS.md "Hard Rules".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');

const BANNED_RULES = [
  'max-lines',
  'max-lines-per-function',
  'max-statements',
  'max-depth',
  'max-params',
  'max-nested-callbacks',
  'complexity',
  'max-classes-per-file',
  'max-statements-per-line',
] as const;

type Violation = { where: string; rule: string; line: number; detail: string };

function listPackageDirs(): string[] {
  return readdirSync(PACKAGES_DIR)
    .map((name) => join(PACKAGES_DIR, name))
    .filter((p) => {
      try {
        return statSync(p).isDirectory();
      } catch {
        return false;
      }
    });
}

function walkSrc(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkSrc(p, out);
      continue;
    }
    const ext = extname(name);
    if (ext !== '.ts' && ext !== '.tsx') continue;
    if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue;
    if (name.endsWith('.spec.ts') || name.endsWith('.spec.tsx')) continue;
    out.push(p);
  }
}

function scanEslintConfig(path: string): Violation[] {
  let src: string;
  try {
    src = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  const violations: Violation[] = [];
  const lines = src.split('\n');
  for (const rule of BANNED_RULES) {
    // Match: `complexity: 'off'`, `'max-lines-per-function': 'off'`, etc.
    const pattern = new RegExp(
      `(?:^|[\\s{,])(?:['"]${rule}['"]|${rule})\\s*:\\s*['"]off['"]`
    );
    lines.forEach((line, idx) => {
      if (pattern.test(line)) {
        violations.push({
          where: relative(REPO_ROOT, path),
          rule,
          line: idx + 1,
          detail: `'${rule}': 'off' override`,
        });
      }
    });
  }
  return violations;
}

function scanSourceFile(path: string): Violation[] {
  let src: string;
  try {
    src = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  if (!src.includes('eslint-disable')) return [];
  const violations: Violation[] = [];
  const lines = src.split('\n');
  for (const rule of BANNED_RULES) {
    // Match: /* eslint-disable max-lines */, // eslint-disable-next-line max-statements, etc.
    const pattern = new RegExp(
      `eslint-disable(?:-next-line|-line)?\\b[^\\n]*\\b${rule}\\b`
    );
    lines.forEach((line, idx) => {
      if (pattern.test(line)) {
        violations.push({
          where: relative(REPO_ROOT, path),
          rule,
          line: idx + 1,
          detail: `inline eslint-disable for ${rule}`,
        });
      }
    });
  }
  return violations;
}

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  for (const pkgDir of listPackageDirs()) {
    // The shared rule definitions and test overrides are the canonical place
    // these names appear — skip them.
    if (relative(PACKAGES_DIR, pkgDir) === 'eslint-rules') continue;

    const cfg = join(pkgDir, 'eslint.config.js');
    violations.push(...scanEslintConfig(cfg));

    const srcDir = join(pkgDir, 'src');
    const srcFiles: string[] = [];
    walkSrc(srcDir, srcFiles);
    for (const f of srcFiles) violations.push(...scanSourceFile(f));
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
