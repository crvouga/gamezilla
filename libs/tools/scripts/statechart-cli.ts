#!/usr/bin/env bun
// @io-wall-ok — statechart compiler entry; file and process ports meet here.
import { mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadSpecDirectory, machineToScxml } from '@crvouga/atlas';
import { StateNodeSchema } from '@crvouga/atlas-schema';
import { run } from '@pkgs/os-server/command';
import { startProcess } from '@pkgs/os-server/streaming-process';
import { analyzeStatecharts } from './statechart-analysis';
import { productContracts } from './statechart-contracts';
import { statechartExplorerFlags } from './statechart-explorer-options';
import { productGuide, unmappedContracts } from './statechart-guide';
import { guideIntegrityProblems } from './statechart-integrity';
import { guideNotes, languageContracts } from './statechart-language';
import { productStatechartSourceProblems } from './statechart-source-policy';
import {
  declaredProductRoutes,
  PRODUCT_ROUTE_ROOTS,
  routeCoverageProblems,
} from './statechart-routes';

const ROOT = resolve(import.meta.dir, '../../..');
const CHARTS = join(ROOT, 'specs');
const CACHE = join(ROOT, '.cache/product-statechart');
const SPECS = join(CACHE, 'specs');
const SITE = join(ROOT, '.cache/product-statechart-explorer');

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value)}\n`);
}

function sourceFiles(): Map<string, string> {
  const sources = new Map(
    [
      ...new Bun.Glob('**/*').scanSync({
        cwd: join(ROOT, 'specs'),
        onlyFiles: true,
      }),
    ]
      .sort()
      .map((path) => [
        `specs/${path}`,
        readFileSync(join(ROOT, 'specs', path), 'utf8'),
      ])
  );
  for (const name of new Bun.Glob('*.md').scanSync({
    cwd: join(ROOT, 'docs/statecharts'),
  })) {
    sources.set(
      `docs/statecharts/${name}`,
      readFileSync(join(ROOT, 'docs/statecharts', name), 'utf8')
    );
    sources.set(
      name,
      readFileSync(join(ROOT, 'docs/statecharts', name), 'utf8')
    );
  }
  const routes = new Set([
    ...PRODUCT_ROUTE_ROOTS,
    ...new Bun.Glob('libs/*-client/src/feature-client.{ts,tsx}').scanSync({
      cwd: ROOT,
    }),
    'libs/chess-puzzle-client/src/puzzle-link-client.ts',
    'libs/chess-puzzle-shared/src/puzzle-link.ts',
  ]);
  for (const path of routes)
    sources.set(path, readFileSync(join(ROOT, path), 'utf8'));
  return sources;
}

function writeGuide(
  machine: ReturnType<typeof productGuide>,
  artifacts: Record<string, unknown>
): void {
  mkdirSync(SPECS, { recursive: true });
  writeJson(join(SPECS, 'product.machine.json'), machine);
  for (const name of ['atlas.yaml', 'journeys.yaml']) {
    writeFileSync(join(SPECS, name), readFileSync(join(CHARTS, name)));
  }
  writeFileSync(join(CACHE, 'product.scxml'), `${machineToScxml(machine)}\n`);
  for (const [name, value] of Object.entries(artifacts))
    writeJson(join(CACHE, `${name}.json`), value);
}

function compileGuide(): void {
  const sources = sourceFiles();
  const routes = declaredProductRoutes(sources);
  const bundle = loadSpecDirectory(CHARTS);
  const analysis = analyzeStatecharts(bundle, { sourceFiles: sources });
  const contracts = [
    ...productContracts(sources),
    ...languageContracts(sources),
    ...guideNotes(sources),
  ];
  const missing = unmappedContracts(bundle, contracts);
  const issues = [
    ...productStatechartSourceProblems(bundle),
    ...analysis.issues.map((issue) => JSON.stringify(issue)),
    ...missing.map((path) => `No chart owns the contract ${path}`),
  ];
  if (!analysis.complete)
    issues.push(
      'Reachability exploration did not finish; coverage is unknown.'
    );
  if (issues.length) throw new Error(issues.join('\n'));
  const machine = JSON.parse(
    JSON.stringify(productGuide(bundle, contracts))
  ) as ReturnType<typeof productGuide>;
  StateNodeSchema.parse(machine);
  const integrity = [
    ...guideIntegrityProblems(bundle, machine, {
      contracts,
      paths: analysis.paths,
      tour: 'Explore the whole product',
      gapSources: ['specs/README.md', 'docs/statecharts/SPEC_CONFLICTS.md'],
    }),
    ...routeCoverageProblems(machine, routes),
  ];
  if (integrity.length)
    throw new Error(integrity.map((issue) => JSON.stringify(issue)).join('\n'));
  writeGuide(machine, { analysis, contracts, routes });
  console.log(
    `Product chart "product": ${analysis.states.length} states, ${analysis.transitions.length} transitions, ${analysis.journeys.length} journeys, ${contracts.length} source-derived rules.`
  );
  console.log(
    `Complete traversal: ${analysis.configurations} configurations; every state and transition reachable and every planned path replayed. All ${routes.length} registered app addresses have chart states.`
  );
  console.log(
    'Model exploration only. Application conformance comes from automated product verification.'
  );
}

async function explore(flags: string[]): Promise<void> {
  const viewerFlags = statechartExplorerFlags(flags);
  const watchers = ['specs', 'docs/statecharts'].map((path) =>
    watch(join(ROOT, path), { recursive: true }, (_event, name) => {
      if (
        !name ||
        !/\.(yaml|yml|json|feature|qnt|dmn|als|scxml|md)$/.test(name)
      )
        return;
      try {
        compileGuide();
      } catch (cause) {
        console.error(
          `Chart update rejected; keeping the last valid model. ${String(cause)}`
        );
      }
    })
  );
  const child = startProcess({
    command: process.execPath,
    args: [
      join(ROOT, 'vendor/atlas/packages/visualizer/bin/atlas-visualizer.mjs'),
      'dev',
      '--specs',
      SPECS,
      '--runs',
      join(ROOT, 'atlas-runs'),
      ...viewerFlags,
    ],
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  const stop = () => child.stop();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    process.exitCode = (await child.completed) ?? 1;
  } finally {
    for (const watcher of watchers) watcher.close();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

async function main(): Promise<void> {
  const [command = 'check', ...flags] = process.argv.slice(2);
  if (flags.includes('--help') || flags.includes('-h')) {
    console.log(
      'bun atlas:lint — validate composition, source closure, complete traversal and serialization.\nbun atlas:run — validate and build the static product explorer.\nbun atlas:export — export the validated product model as SCXML.\nbun atlas:viz [--port N] [--host HOST] — explore without the application server.'
    );
    return;
  }
  if (!['check', 'build', 'explore', 'export'].includes(command))
    throw new Error(`Unknown statechart command: ${command}`);
  if (command !== 'explore' && flags.length)
    throw new Error(`Unexpected flags: ${flags.join(' ')}`);
  compileGuide();
  if (command === 'check') return;
  if (command === 'export') {
    console.log(`Product SCXML exported: ${join(CACHE, 'product.scxml')}`);
    return;
  }
  if (command === 'explore') {
    await explore(flags);
    return;
  }
  run(
    'bun',
    [
      'run',
      'atlas-visualizer',
      'build',
      '--specs',
      SPECS,
      '--runs',
      join(ROOT, 'atlas-runs'),
      '--out',
      SITE,
    ],
    { cwd: ROOT }
  );
  console.log(
    `Explorer built: ${SITE}\nUse bun atlas:viz to explore it; no app stack is needed.`
  );
}

await main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exitCode = 1;
});
