#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Whole-repo naming sweep: Markdown docs are `SCREAMING_SNAKE_CASE.md`, every
 * other file and directory is `lower-kebab-case` (rules + exemptions:
 * `libs/tools/naming/naming-rules.ts`). `bun check-pr` applies the same rules per
 * package inside `lint`; this sweep backs `bun run lint:naming`, the
 * `naming:fix` post-write gate.
 *
 * Built to be as fast as the process can start: one `git ls-files` (index
 * read, honours .gitignore), no fs walk, no stat, each directory judged once.
 * Fix violations with `bun run naming:fix` (dry run) / `--write`.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { findNamingViolations } from '../naming/naming-rules';

const ROOT = join(import.meta.dirname, '../../..');

const listing = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);

const violations = findNamingViolations(listing.split('\0'));

if (violations.length > 0) {
  const lines = violations.map((v) => {
    const parent = v.path.includes('/')
      ? v.path.slice(0, v.path.lastIndexOf('/') + 1)
      : '';
    return `  ${v.kind === 'dir' ? 'dir ' : 'file'}  ${v.path}  →  ${parent}${v.suggested}`;
  });
  console.error(
    `[lint:naming] ${violations.length} path(s) break the naming convention ` +
      '(Markdown docs SCREAMING_SNAKE_CASE.md, everything else lower-kebab-case):\n' +
      `${lines.join('\n')}\n\n` +
      'Preview the fix with `bun run naming:fix`, apply with `bun run naming:fix --write`.'
  );
  process.exit(1);
}
