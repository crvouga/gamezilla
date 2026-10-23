import { dirname, join, resolve } from 'node:path';

const ROOT_MARKERS = [
  'package.json',
  'turbo.json',
  'apps/product-ts/package.json',
] as const;

export function resolveDevRepoRoot(
  startDir: string,
  pathExists: (path: string) => boolean
): string {
  let candidate = resolve(startDir);
  while (true) {
    if (ROOT_MARKERS.every((marker) => pathExists(join(candidate, marker))))
      return candidate;

    const parent = dirname(candidate);
    if (parent === candidate)
      throw new Error(`Unable to find the repository root from ${startDir}`);
    candidate = parent;
  }
}
