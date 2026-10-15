// @io-wall-ok — discovers the spec files of a package for the CLI adapters.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSyntheticFeatureSource } from '@pkgs/gherkin-shared/tags';
import { isLiveObjectiveSource } from '@pkgs/openslo-shared/live';
import { SPEC_GLOBS } from './spec-check-kinds';

export type SpecManifest = { specDomains?: string[]; specParts?: number };

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
