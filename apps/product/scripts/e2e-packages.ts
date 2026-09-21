// @io-wall-ok — CLI helper: find and run every package's e2e suite.
/**
 * The e2e suites live with the features they exercise (`libs/<feature>/tests/e2e`)
 * and the whole-app one with the composition root. The live-browser runners
 * (`test:max`, `test:stack`) drive all of them, one package at a time: each
 * package's `test:e2e` is the same harness runner, so a suite runs the same
 * way here as in `bun check`, only on the `bun-webview` host.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REPO_ROOT = join(import.meta.dirname, '../../..');

/** Repo-relative dirs of every package that declares `test:e2e`. */
export function e2ePackageDirs(): string[] {
  const dirs: string[] = [];
  for (const tier of ['apps', 'libs', 'pkgs']) {
    for (const name of readdirSync(join(REPO_ROOT, tier))) {
      const manifest = join(REPO_ROOT, tier, name, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
        readonly scripts?: Record<string, string>;
      };
      if (pkg.scripts?.['test:e2e'] !== undefined) dirs.push(`${tier}/${name}`);
    }
  }
  return dirs.sort();
}

/** Run each package's `test:e2e` with `env`; the first failure's code, else 0. */
export function runE2ePackages(
  env: NodeJS.ProcessEnv,
  testArgs: readonly string[]
): number {
  let code = 0;
  for (const dir of e2ePackageDirs()) {
    process.stdout.write(`\n[e2e] ${dir}\n`);
    const result = spawnSync('bun', ['run', 'test:e2e', ...testArgs], {
      cwd: join(REPO_ROOT, dir),
      stdio: 'inherit',
      env,
    });
    if (result.status !== 0 && code === 0) code = result.status ?? 1;
  }
  return code;
}
