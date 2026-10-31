#!/usr/bin/env bun
// @io-wall-ok — cache hygiene gate entry (`@libs/tools-harness-ts#ci:cache-hygiene`).
/**
 * Fails when the workspace is structured so that small edits miss the Turbo
 * cache for many tasks (`cache-hygiene.ts` has the rules and the reasons).
 *
 *   bun run libs/tools-harness-ts/scripts/verify-cache-hygiene.ts            check
 *   bun run cache:sync                                                       rewrite derived files
 *   bun run cache:sync -- --accept-hubs                                      also accept today's hubs
 *   bun run cache:explain <package>                                          why a package is costly
 *
 * The thresholds are in `libs/tools-harness-ts/cache-hygiene.json`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sliceDrift, syncBiomeSlices } from './biome-scope-slices';
import { fileReach, readImportGraph } from './cache-file-reach';
import {
  type Blast,
  blastRadii,
  type GraphPackage,
  readGraph,
  srcDependents,
} from './cache-graph';
import {
  broadInputViolations,
  derivedViolations,
  globalInputViolations,
  hubViolations,
  type LightFile,
  type Policy,
  type TaskInputs,
  type Violation,
} from './cache-hygiene';
import { srcEdgeDrift, syncSrcEdges } from './src-task-edges';

const ROOT = join(import.meta.dirname, '../../..');
const POLICY_FILE = 'libs/tools-harness-ts/cache-hygiene.json';

type TurboFile = {
  globalDependencies?: string[];
  globalEnv?: string[];
  tasks?: Record<string, { inputs?: string[] }>;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as T;
}

export function readPolicy(): Policy {
  return readJson<Policy>(POLICY_FILE);
}

function taskInputs(packages: readonly GraphPackage[]): TaskInputs[] {
  const found: TaskInputs[] = [];
  const add = (prefix: string, file: TurboFile): void => {
    for (const [task, definition] of Object.entries(file.tasks ?? {}))
      found.push({ task: prefix + task, inputs: definition.inputs ?? [] });
  };
  add('', readJson<TurboFile>('turbo.json'));
  for (const { dir, name } of packages) {
    try {
      add(`${name}#`, readJson<TurboFile>(`${dir}/turbo.json`));
    } catch {
      // No package turbo.json.
    }
  }
  return found;
}

function lightFiles(
  reach: (file: string, threshold: number) => number,
  pkg: GraphPackage,
  radius: number,
  policy: Policy
): LightFile[] {
  const threshold = Math.max(
    3,
    Math.floor(radius * policy.limits.cohesion.lightReach)
  );
  return pkg.srcFiles
    .map((file) => ({ file, packages: reach(file, threshold) }))
    .filter((entry) => entry.packages <= threshold)
    .sort((a, b) => a.packages - b.packages || a.file.localeCompare(b.file));
}

export function cacheHygieneViolations(policy = readPolicy()): Violation[] {
  const packages = readGraph(ROOT);
  const blast = blastRadii(packages);
  const imports = readImportGraph(ROOT);
  const reach = (file: string, threshold: number): number =>
    fileReach(imports, file, threshold).packages;
  const turbo = readJson<TurboFile>('turbo.json');
  const base = readJson<{ compilerOptions?: { paths?: unknown } }>(
    'tsconfig.base.json'
  );
  return [
    ...hubViolations({ packages, blast, policy }, (pkg) =>
      lightFiles(reach, pkg, blast.get(pkg.name)?.packages.size ?? 0, policy)
    ),
    ...broadInputViolations(taskInputs(packages), policy),
    ...globalInputViolations(
      {
        globalDependencies: turbo.globalDependencies ?? [],
        globalEnv: turbo.globalEnv ?? [],
        baseHasAliases: base.compilerOptions?.paths !== undefined,
      },
      policy
    ),
    ...derivedViolations({
      srcEdges: srcEdgeDrift().map((drift) => `${drift.dir}/turbo.json`),
      biomeSlices: sliceDrift(),
    }),
  ];
}

function acceptHubs(): number {
  const policy = readPolicy();
  const packages = readGraph(ROOT);
  const hubs = Object.fromEntries(
    [...blastRadii(packages)]
      .map(([name, blast]) => [name, blast.packages.size] as const)
      .filter(([, size]) => size >= policy.limits.hubBlast)
      .sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(
    join(ROOT, POLICY_FILE),
    `${JSON.stringify({ ...policy, hubs }, null, 2)}\n`
  );
  return Object.keys(hubs).length;
}

function describe(blast: Blast | undefined): string {
  return blast === undefined
    ? 'unknown'
    : `${String(blast.packages.size)} packages rerun, ${String(blast.srcHashes.size)} src hashes change`;
}

function explain(name: string): void {
  const policy = readPolicy();
  const packages = readGraph(ROOT);
  const blast = blastRadii(packages);
  const pkg = packages.find((p) => p.name === name || p.dir === name);
  if (pkg === undefined) {
    console.error(`no workspace package named ${name}`);
    process.exit(1);
  }
  const imports = readImportGraph(ROOT);
  const own = blast.get(pkg.name);
  console.log(`${pkg.name}: ${describe(own)}`);
  console.log(`  source files: ${String(pkg.srcFiles.length)}`);
  console.log('  direct dependents through src (blast of each):');
  for (const dependent of srcDependents(packages, pkg.name)
    .map((d) => [d, blast.get(d)?.packages.size ?? 0] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15))
    console.log(`    ${dependent[0]}: ${String(dependent[1])}`);
  const files = lightFiles(
    (file, threshold) => fileReach(imports, file, threshold).packages,
    { ...pkg, srcFiles: pkg.srcFiles },
    own?.packages.size ?? 0,
    policy
  );
  console.log(
    `  files that reach few packages (candidates for a package of their own): ${String(files.length)}`
  );
  for (const f of files.slice(0, 25))
    console.log(`    ${f.file} (reaches ${String(f.packages)})`);
}

function sync(argv: readonly string[]): void {
  const edges = syncSrcEdges();
  const slices = syncBiomeSlices();
  console.log(
    `cache sync: ${String(edges)} src edge files, ${String(slices)} Biome slice files rewritten`
  );
  if (argv.includes('--accept-hubs'))
    console.log(
      `cache sync: ${String(acceptHubs())} hubs recorded in ${POLICY_FILE}`
    );
}

function check(): void {
  const violations = cacheHygieneViolations();
  if (violations.length > 0) {
    console.error(
      `cache hygiene (docs/CI_REQUIREMENTS.md#cache-friendly-structure):\n\n${violations
        .map((v) => `[${v.rule}] ${v.message}`)
        .join('\n\n')}`
    );
    process.exit(1);
  }
  console.log(
    `cache hygiene: no violation across ${String(readGraph(ROOT).length)} packages`
  );
}

if (import.meta.main) {
  const [mode, argument] = process.argv.slice(2);
  if (mode === '--sync') sync(process.argv.slice(3));
  else if (mode === '--explain' && argument !== undefined) explain(argument);
  else check();
}
