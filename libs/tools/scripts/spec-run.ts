#!/usr/bin/env bun
// @io-wall-ok — CLI entry (`bun run spec`).
/**
 * Run specs — Gherkin features and Quint models — across every package that
 * runs `specs/<domain>/` domains against the harness. A spec path
 * (`specs/chess/puzzle-play.feature`, `specs/spaces/space-hosting.qnt`) goes
 * only to the package whose `specDomains` lists its domain. Live domains
 * (`liveDomains`) run through `bun run health`, never here.
 */

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

function hasSpecScript(dir: string): boolean {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8')
  ) as { readonly scripts?: Readonly<Record<string, string>> };
  return manifest.scripts?.['test:spec'] !== undefined;
}

function domainOfPath(arg: string): string | null {
  return (
    /^(?:\.\/)?specs\/([a-z0-9-]+)\/[^/]+\.(?:feature|qnt)$/.exec(arg)?.[1] ??
    null
  );
}

const cli = parseCli(process.argv.slice(2));
const discovered = specPackages().filter((pkg) => pkg.specDomains.length > 0);
const featureDomains = new Set(
  cli.runnerArgs.flatMap((arg) => {
    const domain = domainOfPath(arg);
    return domain === null ? [] : [domain];
  })
);
const selected = discovered.filter(
  (pkg) =>
    (cli.packages.size === 0 || cli.packages.has(pkg.name)) &&
    (featureDomains.size === 0 ||
      pkg.specDomains.some((domain) => featureDomains.has(domain)))
);
const known = new Set(discovered.map((pkg) => pkg.name));
const unknown = [...cli.packages].filter((name) => !known.has(name));
if (unknown.length > 0) {
  throw new Error(
    `unknown spec package${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`
  );
}
if (selected.length === 0) throw new Error('no spec packages selected');

for (const pkg of selected) {
  if (!hasSpecScript(pkg.dir)) {
    throw new Error(`${pkg.name} runs specDomains but has no test:spec script`);
  }
  console.log(`spec: ${pkg.name}`);
  const args = cli.runnerArgs.filter((arg) => {
    const domain = domainOfPath(arg);
    return domain === null || pkg.specDomains.includes(domain);
  });
  const result = spawnSync(
    'bun',
    ['run', '--filter', pkg.name, 'test:spec', ...args],
    { cwd: REPO_ROOT, env: process.env, stdio: 'inherit' }
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
