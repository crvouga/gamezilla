// @io-wall-ok — CLI helper: find and run every package's spec suite.
/**
 * The spec suites live with the features they exercise (`libs/<feature>/tests/harness`)
 * and the whole-app one with the composition root. The live-browser runners
 * (`test:max`, `test:stack`) drive all of them, one package at a time: each
 * package's `test:spec` is the same harness runner, so a suite runs the same
 * way here as in `bun check`, only on the `bun-webview` host.
 */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { specProcessExit } from './spec-process';

export const REPO_ROOT = join(import.meta.dirname, '../../..');

/** Repo-relative dirs of every package that declares `test:spec`. */
export function specPackageDirs(): string[] {
  const dirs: string[] = [];
  for (const tier of ['apps', 'libs', 'pkgs']) {
    for (const name of readdirSync(join(REPO_ROOT, tier))) {
      const manifest = join(REPO_ROOT, tier, name, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
        readonly scripts?: Record<string, string>;
      };
      if (pkg.scripts?.['test:spec'] !== undefined)
        dirs.push(`${tier}/${name}`);
    }
  }
  return dirs.sort();
}

/**
 * Run `test:spec` with `env` in every package, or — when `args` name
 * repo-relative spec paths (`libs/runtime/tests/harness/critical-journeys.test.tsx`) —
 * only in the packages that own them, each given its own paths. Flags pass to
 * every run. The first failure's code, else 0.
 */
export async function runSpecSuites(
  env: NodeJS.ProcessEnv,
  args: readonly string[]
): Promise<number> {
  const dirs = specPackageDirs();
  const paths = args.filter((arg) =>
    /(?:\.test\.[cm]?[jt]sx?|\.feature)$/.test(arg)
  );
  const flags = args.filter((arg) => !paths.includes(arg));
  const runs = new Map<string, string[]>();
  for (const path of paths) {
    const dir = owningPackage(dirs, path);
    if (dir === undefined) {
      process.stderr.write(`[spec] no spec package owns ${path}\n`);
      return 1;
    }
    const local = relative(join(REPO_ROOT, dir), resolve(REPO_ROOT, path));
    runs.set(dir, [...(runs.get(dir) ?? []), local]);
  }
  if (paths.length === 0) for (const dir of dirs) runs.set(dir, []);
  let code = 0;
  for (const [dir, own] of runs) {
    process.stdout.write(`\n[spec] ${dir}\n`);
    const status = await runSpecProcess(dir, env, [...flags, ...own]);
    if (status !== 0 && code === 0) code = status;
  }
  return code;
}

function owningPackage(
  dirs: readonly string[],
  path: string
): string | undefined {
  if (!path.endsWith('.feature'))
    return dirs.find((dir) => path.startsWith(`${dir}/`));
  const domain = relative(
    join(REPO_ROOT, 'specs'),
    resolve(REPO_ROOT, path)
  ).split('/')[0];
  const owners = dirs.filter((dir) => {
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8')
    ) as { specDomains?: string[] };
    return domain !== undefined && manifest.specDomains?.includes(domain);
  });
  return owners.length === 1 ? owners[0] : undefined;
}

/** Await the child without starving the stack's in-process service listeners. */
export function runSpecProcess(
  dir: string,
  env: NodeJS.ProcessEnv,
  args: readonly string[]
): Promise<number> {
  return specProcessExit(
    spawn('bun', ['run', 'test:spec', ...args], {
      cwd: join(REPO_ROOT, dir),
      stdio: 'inherit',
      env,
    })
  );
}
