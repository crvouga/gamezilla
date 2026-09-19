#!/usr/bin/env bun
// goal:the-bar:4
// @io-wall-ok — composition root
/**
 * No-skipped-tests gate (`//#ci:no-skipped-tests`): scans `apps/`, `libs/`,
 * and `pkgs/` for test files and fails when any matched file contains a skip
 * directive. This ensures checks are trustworthy: no test is silently skipped,
 * no platform-gated `process.exit(0)` bypasses verification.
 *
 * Skips generated locale files only.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Glob } from 'bun';

const ROOT = join(import.meta.dirname, '../../..');

/** Glob patterns for test files. */
const TEST_PATTERNS = [
  'apps/**/*.test.ts',
  'apps/**/*.test.tsx',
  'apps/**/*.spec.ts',
  'apps/**/*.spec.tsx',
  'libs/**/*.test.ts',
  'libs/**/*.test.tsx',
  'libs/**/*.spec.ts',
  'libs/**/*.spec.tsx',
  'pkgs/**/*.test.ts',
  'pkgs/**/*.test.tsx',
  'pkgs/**/*.spec.ts',
  'pkgs/**/*.spec.tsx',
];

/** Generated locale files to exclude. */
const GENERATED_LOCALE_PATTERNS = ['/locales/', '/generated/'];

/** Skip patterns to detect. Each is a [label, regex] pair. */
const SKIP_PATTERNS: [string, RegExp][] = [
  ['test.skip(', /test\.skip\s*\(/],
  ['it.skip(', /it\.skip\s*\(/],
  ['describe.skip(', /describe\.skip\s*\(/],
  ['.skipIf(', /\.skipIf\s*\(/],
];

function isGeneratedLocale(filePath: string): boolean {
  for (const pattern of GENERATED_LOCALE_PATTERNS) {
    if (filePath.includes(pattern)) return true;
  }
  return false;
}

function scanForSkippedTests(): Map<string, string[]> {
  const violations = new Map<string, string[]>();

  for (const pattern of TEST_PATTERNS) {
    const glob = new Glob(pattern);
    for (const file of glob.scanSync({ cwd: ROOT, absolute: false })) {
      if (isGeneratedLocale(file)) continue;

      const absPath = join(ROOT, file);
      if (!existsSync(absPath)) continue;

      const content = readFileSync(absPath, 'utf8');
      const lines = content.split('\n');
      const fileViolations: string[] = [];

      for (const [label, regex] of SKIP_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            fileViolations.push(
              `  line ${i + 1}: ${label} — ${lines[i].trim()}`
            );
          }
        }
      }

      // Check for process.exit(0) — flag if the surrounding context mentions skip
      for (let i = 0; i < lines.length; i++) {
        if (/process\.exit\s*\(\s*0\s*\)/.test(lines[i])) {
          const contextLines = lines
            .slice(Math.max(0, i - 3), i + 2)
            .join('\n')
            .toLowerCase();
          if (
            contextLines.includes('skip') ||
            contextLines.includes('darwin') ||
            contextLines.includes('platform')
          ) {
            fileViolations.push(
              `  line ${i + 1}: process.exit(0) in skip/platform branch — ${lines[i].trim()}`
            );
          }
        }
      }

      if (fileViolations.length > 0) {
        violations.set(file, fileViolations);
      }
    }
  }

  return violations;
}

export function checkNoSkippedTests(): string[] {
  const violations = scanForSkippedTests();
  const errors: string[] = [];

  for (const [file, fileErrors] of violations) {
    errors.push(`${file}:`);
    errors.push(...fileErrors);
  }

  return errors;
}

if (import.meta.main) {
  const errors = checkNoSkippedTests();

  if (errors.length > 0) {
    console.error('no-skipped-tests gate failed:');
    for (const err of errors) console.error(`  ${err}`);
    process.exit(1);
  }

  console.log('ok: no skipped tests found');
}
