// @io-wall-ok — discovers the spec files of a package for the CLI adapters.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSyntheticFeatureSource } from '@pkgs/gherkin-shared-ts/tags';
import { isLiveObjectiveSource } from '@pkgs/openslo-shared-ts/live';
import { SPEC_GLOBS } from './spec-verify-kinds';

export type SpecManifest = {
  specDomains?: string[];
  specParts?: number;
  /**
   * Its scenarios share server state no run can partition (one Synthetic
   * Population, one permission policy), so on a localhost stack, where
   * every scenario meets the same database, they run one at a time.
   */
  stackSerial?: boolean;
};

/**
 * How many spec workers run side by side: `parallelism`, except one for a
 * `stackSerial` package on a localhost stack.
 */
export function specWorkers(
  env: NodeJS.ProcessEnv,
  manifest: SpecManifest,
  parallelism: number
): number {
  return env['HARNESS_MODE']?.trim() === 'stack' &&
    manifest.stackSerial === true
    ? 1
    : parallelism;
}

export function packageSpecManifest(packageDir: string): SpecManifest {
  if (!existsSync(join(packageDir, 'package.json'))) return {};
  return JSON.parse(
    readFileSync(join(packageDir, 'package.json'), 'utf8')
  ) as SpecManifest;
}

export function packageSpecDomains(packageDir: string): readonly string[] {
  if (!existsSync(join(packageDir, 'package.json'))) return [];
  const manifest = JSON.parse(
    readFileSync(join(packageDir, 'package.json'), 'utf8')
  ) as SpecManifest;
  return manifest.specDomains ?? [];
}

export function packageSpecs(packageDir: string, root: string): string[] {
  return packageSpecDomains(packageDir).flatMap((domain) => {
    const dir = join(root, 'specs', domain);
    if (!existsSync(dir)) return [];
    return [
      ...new Set(
        SPEC_GLOBS.flatMap((glob) => [
          ...new Bun.Glob(glob).scanSync({ cwd: dir }),
        ])
      ),
    ]
      .sort()
      .filter((file) => file !== 'events.qnt')
      .map((file) => join(dir, file))
      .filter(keepsSpec);
  });
}

function keepsSpec(path: string): boolean {
  if (path.endsWith('.feature'))
    return !isSyntheticFeatureSource(readFileSync(path, 'utf8'));
  if (path.endsWith('.openslo.yaml'))
    return !isLiveObjectiveSource(readFileSync(path, 'utf8'));
  return true;
}
