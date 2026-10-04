import { dirname, join } from 'node:path';
import type { TofuPaths } from '@libs/infra-shared/tofu-command';

export type TofuLayout = {
  readonly paths: TofuPaths;
  readonly policyDir: string;
};

/** Resolve the shared declarations from the server package that executes them. */
export function tofuLayout(infraServerDir: string): TofuLayout {
  const sharedDir = join(dirname(infraServerDir), 'infra-shared');
  return {
    paths: {
      tofuDir: join(sharedDir, 'tofu'),
      cacheDir: join(infraServerDir, '.cache/tofu'),
    },
    policyDir: join(sharedDir, 'policy'),
  };
}
