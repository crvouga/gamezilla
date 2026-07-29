#!/usr/bin/env bun
/**
 * Fail-fast guardrail: this repo bans dependency patches.
 *
 * Patching third-party deps in-tree (`bun patch`, patch-package, pnpm patch,
 * `resolutions`, etc.) creates invisible forks that drift, break upgrades,
 * and hide bugs from upstream. Work around third-party bugs in our own code
 * or accept the behavior. See AGENTS.md.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');

type Violation = { where: string; detail: string };

function findViolations(): Violation[] {
  const violations: Violation[] = [];

  if (existsSync(join(REPO_ROOT, 'patches'))) {
    violations.push({
      where: 'patches/',
      detail: 'Dependency patch directory exists.',
    });
  }

  const pkgJsonPath = join(REPO_ROOT, 'package.json');
  if (existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
      patchedDependencies?: unknown;
      pnpm?: { patchedDependencies?: unknown };
      resolutions?: unknown;
    };
    if (pkg.patchedDependencies) {
      violations.push({
        where: 'package.json:patchedDependencies',
        detail: 'Bun-style dep patches are forbidden.',
      });
    }
    if (pkg.pnpm?.patchedDependencies) {
      violations.push({
        where: 'package.json:pnpm.patchedDependencies',
        detail: 'pnpm-style dep patches are forbidden.',
      });
    }
    if (pkg.resolutions) {
      violations.push({
        where: 'package.json:resolutions',
        detail:
          'Yarn-style `resolutions` overrides are forbidden (use `overrides` only for security-pin upgrades, never to fork a dep).',
      });
    }
  }

  return violations;
}

const violations = findViolations();
if (violations.length === 0) {
  console.log('check:no-patches OK — no dependency patches found.');
  process.exit(0);
}

console.error('check:no-patches FAILED — dependency patching is forbidden.');
for (const v of violations) {
  console.error(`  - ${v.where}: ${v.detail}`);
}
console.error(
  '\nWork around third-party bugs in our own code, or accept the behavior. See AGENTS.md.'
);
process.exit(1);
