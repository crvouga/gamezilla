#!/usr/bin/env bun
// @io-wall-ok — CI entry: reads package manifests, prints GITHUB_OUTPUT lines
/**
 * The Check workflow's report parts, as a `GITHUB_OUTPUT` line. `check:plan`
 * appends it to the shard plan, and `check:matrix` (a job that loads no
 * secrets) publishes both:
 *
 *   bun run libs/tools/scripts/report-matrix.ts >> "$RUNNER_TEMP/shard-plan.txt"
 *
 *   parts=[0,1,2,3,4]
 *
 * One `check:publish` runner per spec part: part `k` publishes `test:spec:<k>`
 * of every package that has one. `bun check` splits every suite the same way
 * and weighs the parts to be about equal, so the parts finish together.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './spec-packages';

type Manifest = {
  readonly specParts?: number;
  readonly scripts?: Readonly<Record<string, string>>;
};

/** `[0 … max(specParts) - 1]`; empty when no package has a spec suite. */
export function partIndexes(counts: readonly number[]): readonly number[] {
  const most = Math.max(0, ...counts);
  return Array.from({ length: most }, (_, k) => k);
}

function specPartCounts(): number[] {
  const counts: number[] = [];
  for (const tier of ['apps', 'libs', 'pkgs']) {
    for (const name of readdirSync(join(REPO_ROOT, tier))) {
      const manifest = join(REPO_ROOT, tier, name, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as Manifest;
      if (pkg.scripts?.['test:spec'] !== undefined) {
        counts.push(pkg.specParts ?? 1);
      }
    }
  }
  return counts;
}

if (import.meta.main) {
  console.log(`parts=${JSON.stringify(partIndexes(specPartCounts()))}`);
}
