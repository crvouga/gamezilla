#!/usr/bin/env bun
// @io-wall-ok — CI gate entry (`bun run ci:conformance`, `//#ci:conformance`).
/**
 * The conformance gate: the world `specs/conformance.yaml` describes is
 * closed and every entry of it is proven automatically (specs/README.md
 * "The conformance manifest"; strategy §§ 11, 12, 18, 19, 22, 23, 25.3).
 *
 * - The manifest reads cleanly: no manual testing, every non-pass state in
 *   `fail on`, every requirement known, ids unique, every kind `required`.
 * - Its contexts are exactly `specs/<context>/`; every capability is answered
 *   by the decision table it names and every table's capabilities are
 *   declared; every objective measures a declared context.
 * - Every required kind of spec has a spec and every spec is bound.
 * - The evidence map (`libs/tools/conformance/evidence-map.ts`) names exactly
 *   the manifest's environments, public contracts, release gates and
 *   readiness requirements, and every proof in it is automated: a spec that
 *   exists and is bound, a task `//#check` reaches, a live spec `health` runs.
 *
 * Static and fast: it reads files and parses specs, runs no suite. Whether the
 * suites *passed* is `bun run conformance` (`conformance-report.ts`), from the
 * evidence they record.
 */

import { closureProblems } from '@pkgs/conformance/closure';

import { readConformanceWorld } from '../conformance/world';

const {
  world,
  manifest,
  specs,
  problems: readProblems,
} = readConformanceWorld();
const problems = [
  ...readProblems,
  ...(world === null ? [] : closureProblems(world)),
];

if (problems.length > 0 || manifest === null) {
  console.error('conformance check failed — the world is not closed:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

const count = (n: number, noun: string): string => `${String(n)} ${noun}`;
console.log(
  `ok: conformance world is closed (${[
    count(manifest.product.contexts.length, 'contexts'),
    count(manifest.product.capabilities.length, 'capabilities'),
    count(specs.length, 'specs'),
    count(manifest.environments.length, 'environments'),
    count(manifest.product['public contracts'].length, 'public contracts'),
    count(manifest['release gates'].length, 'release gates'),
    count(
      manifest['production readiness'].require.length,
      'readiness requirements'
    ),
  ].join(', ')})`
);
