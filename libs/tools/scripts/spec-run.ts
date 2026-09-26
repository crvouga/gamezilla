#!/usr/bin/env bun
// @io-wall-ok — CLI entry (`bun run spec`).
/** Run Gherkin features across every package that owns a `features/` tree. */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, specPackages } from './spec-packages';

type Cli = {
  readonly packages: ReadonlySet<string>;
  readonly runnerArgs: readonly string[];
};

function parseCli(argv: readonly string[]): Cli {
  const packages = new Set<string>();
  const runnerArgs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--package') {
      const name = argv[++i];
      if (name === undefined)
        throw new Error('--package needs a workspace name');
      packages.add(name);
    } else if (arg.startsWith('--package=')) {
      packages.add(arg.slice('--package='.length));
    } else {
      runnerArgs.push(arg);
    }
  }
  return { packages, runnerArgs };
}

function hasE2eScript(dir: string): boolean {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8')
  ) as { readonly scripts?: Readonly<Record<string, string>> };
  return manifest.scripts?.['test:e2e'] !== undefined;
}

const cli = parseCli(process.argv.slice(2));
const discovered = specPackages();
const selected = discovered.filter(
  (pkg) => cli.packages.size === 0 || cli.packages.has(pkg.name)
);
const known = new Set(discovered.map((pkg) => pkg.name));
const unknown = [...cli.packages].filter((name) => !known.has(name));
if (unknown.length > 0) {
  throw new Error(
    `unknown spec package${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`
  );
}
if (selected.length === 0)
  throw new Error('no packages with features/ selected');

for (const pkg of selected) {
  if (!hasE2eScript(pkg.dir)) {
    throw new Error(`${pkg.name} owns features/ but has no test:e2e script`);
  }
  console.log(`spec: ${pkg.name}`);
  const result = spawnSync(
    'bun',
    ['run', '--filter', pkg.name, 'test:e2e', ...cli.runnerArgs],
    { cwd: REPO_ROOT, env: process.env, stdio: 'inherit' }
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
