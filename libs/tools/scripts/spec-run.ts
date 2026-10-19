#!/usr/bin/env bun
// @io-wall-ok — CLI entry (`bun run spec`).
/**
 * Run specs — Gherkin features, Quint models, decision tables, structures and
 * objectives — across every package that runs `specs/<domain>/` domains
 * against the harness. A spec path (`specs/games/puzzle-play.feature`,
 * `specs/spaces/space-hosting.qnt`, `specs/billing/access.dmn`) goes
 * only to the package whose `specDomains` lists its domain. Live domains
 * (`liveDomains`) run through `bun run health`, never here.
 *
 * A failed package stops the run, so the first red is the last thing printed.
 * `--keep-going` (`bun atlas:run`) runs every selected package regardless, so
 * Atlas receives evidence from all of them, and still exits with the first
 * failure's status.
 */

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wallClock } from '@pkgs/clock-shared/wall';
import { REPO_ROOT, specPackages } from './spec-packages';

type Cli = {
  readonly keepGoing: boolean;
  readonly packages: ReadonlySet<string>;
  readonly runnerArgs: readonly string[];
};

function parseCli(argv: readonly string[]): Cli {
  const packages = new Set<string>();
  const runnerArgs: string[] = [];
  let keepGoing = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--keep-going') {
      keepGoing = true;
    } else if (arg === '--package') {
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
  return { keepGoing, packages, runnerArgs };
}

function hasSpecScript(dir: string): boolean {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8')
  ) as { readonly scripts?: Readonly<Record<string, string>> };
  return manifest.scripts?.['test:spec'] !== undefined;
}

function domainOfPath(arg: string): string | null {
  return (
    /^(?:\.\/)?specs\/([a-z0-9-]+)\/[^/]+\.(?:feature|qnt|dmn|als|openslo\.yaml)$/.exec(
      arg
    )?.[1] ?? null
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

const collectors: Promise<number>[] = [];
let collectionTail: Promise<number> = Promise.resolve(0);
let failure: number | null = null;
for (const pkg of selected) {
  if (!hasSpecScript(pkg.dir)) {
    throw new Error(`${pkg.name} runs specDomains but has no test:spec script`);
  }
  console.log(`spec: ${pkg.name}`);
  const args = cli.runnerArgs.filter((arg) => {
    const domain = domainOfPath(arg);
    return domain === null || pkg.specDomains.includes(domain);
  });
  const attemptId = `${pkg.dir}:${process.pid}:${wallClock.now()}`;
  const result = spawnSync(
    'bun',
    ['run', '--filter', pkg.name, 'test:spec', ...args],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        ATLAS_REPORT_ATTEMPT_ID: attemptId,
      },
      stdio: 'inherit',
    }
  );
  // Publish each package as soon as it finishes so Atlas fills in while the
  // remaining packages continue running. Failed packages also have useful
  // partial evidence and must be collected before returning their status.
  collectionTail = collectionTail.then(
    () =>
      new Promise<number>((resolve) => {
        const collected = spawn(
          'bun',
          [
            'run',
            'libs/harness/scripts/reports-local.ts',
            'collect',
            '--package-dir',
            pkg.dir,
            '--attempt-id',
            attemptId,
          ],
          { cwd: REPO_ROOT, env: process.env, stdio: 'inherit' }
        );
        collected.once('error', (error) => {
          console.error(
            `Could not start local report collection: ${error.message}`
          );
          resolve(1);
        });
        collected.once('exit', (status) => resolve(status ?? 1));
      })
  );
  collectors.push(collectionTail);
  if (result.status !== 0) {
    failure ??= result.status ?? 1;
    if (!cli.keepGoing) break;
  }
}
const collectionStatuses = await Promise.all(collectors);
if (collectionStatuses.some((status) => status !== 0)) process.exit(1);
if (failure !== null) process.exit(failure);
