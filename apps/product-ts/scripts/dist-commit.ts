// @io-wall-ok — reads the built web assets before the deploy uploads them.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fails unless a script in `dist` embeds `commitHash` (`VITE_COMMIT_HASH`),
 * so a bundle built without this commit's identity is never deployed as it.
 */
export function assertDistBuiltFor(dist: string, commitHash: string): void {
  const built = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .some((entry) =>
      readFileSync(join(entry.parentPath, entry.name), 'utf8').includes(
        commitHash
      )
    );
  if (built) return;
  throw new Error(
    `product-worker: ${dist} was not built for ${commitHash}; build it with VITE_COMMIT_HASH=${commitHash}, as the Release workflow does`
  );
}
