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

/**
 * Run `test:e2e` with `env` in every package, or — when `args` name
 * repo-relative spec paths (`libs/chess/tests/e2e/puzzle-play.test.tsx`) —
 * only in the packages that own them, each given its own paths. Flags pass to
 * every run. The first failure's code, else 0.
 */
export function runE2ePackages(
  env: NodeJS.ProcessEnv,
  args: readonly string[]
): number {
  const dirs = e2ePackageDirs();
  const paths = args.filter((arg) => /\.test\.[cm]?[jt]sx?$/.test(arg));
  const flags = args.filter((arg) => !paths.includes(arg));
  const runs = new Map<string, string[]>();
  for (const path of paths) {
    const dir = dirs.find((d) => path.startsWith(`${d}/`));
    if (dir === undefined) {
      process.stderr.write(`[e2e] no e2e package owns ${path}\n`);
      return 1;
    }
    runs.set(dir, [...(runs.get(dir) ?? []), path.slice(dir.length + 1)]);
  }
  if (paths.length === 0) for (const dir of dirs) runs.set(dir, []);
  let code = 0;
  for (const [dir, own] of runs) {
    process.stdout.write(`\n[e2e] ${dir}\n`);
    const result = spawnSync('bun', ['run', 'test:e2e', ...flags, ...own], {
      cwd: join(REPO_ROOT, dir),
      stdio: 'inherit',
      env,
    });
    if (result.status !== 0 && code === 0) code = result.status ?? 1;
  }
  return code;
}
