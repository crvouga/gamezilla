#!/usr/bin/env bun
// @io-wall-ok — CI entry: reads package manifests, prints GITHUB_OUTPUT lines
/**
 * The Report workflow's shard list, as a `GITHUB_OUTPUT` line from a job that
 * loads no secrets:
 *
 *   bun run libs/tools/scripts/report-matrix.ts >> "$GITHUB_OUTPUT"
 *
 *   parts=[0,1,2,3,4]
 *
 * One runner per spec part: shard `k` runs `test:spec:<k>` of every package
 * that has one. `bun check` splits every suite the same way and weighs the
 * parts to be about equal, so the shards finish together.
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
