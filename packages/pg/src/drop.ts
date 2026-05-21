/**
 * Destructive: stop the managed local PostgreSQL cluster (if running) AND
 * delete its on-disk state directory (`packages/pg/.postgres/`), wiping every
 * database it ever held. The next `bun run --filter @gamezilla/pg dev` boots
 * a fresh cluster via `initdb`.
 *
 * Scope is intentional and identical to `kill.ts`: this only touches state
 * inside `packages/pg/` (`.postgres/` and the legacy `.pglite/` folder still
 * listed in `.gitignore`). It will never delete a Homebrew/system Postgres
 * data directory or kill an unrelated server on port 5432.
 *
 * Order of operations:
 *
 * 1. Reuse `killCluster` from `kill.ts` to gracefully stop the wrapper +
 *    postmaster. Skipping this step would leak a live postmaster holding open
 *    files in the directory we're about to remove.
 * 2. `rm -rf` the state dir and the legacy embedded-runtime dir.
 *
 * This is a dev-only quality-of-life script. There is no confirmation prompt
 * (matching the rest of `packages/pg`); the data lives entirely in gitignored
 * directories that `dev` reinitializes from scratch on next boot.
 */

import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLogger } from '@gamezilla/logger';
import { killCluster } from './kill';
import { APP_ROOT, STATE_DIR } from './postgres-paths';

const log = createLogger({ name: 'pg' });

function dropDir(label: string, dir: string): void {
  if (!existsSync(dir)) {
    log.info('drop: nothing to remove', { label, dir });
    return;
  }
  log.warn('drop: removing directory', { label, dir });
  rmSync(dir, { recursive: true, force: true });
}

async function main(): Promise<void> {
  log.warn('drop: stopping cluster before deleting state', {
    stateDir: STATE_DIR,
  });
  await killCluster(log);

  // Active state dir owned by the current Postgres lifecycle.
  dropDir('state-dir', STATE_DIR);
  // Leftover dir from the previous embedded runtime (still in .gitignore).
  dropDir('legacy-pglite', resolve(APP_ROOT, '.pglite'));

  log.info('drop complete; next `dev` will reinitialize a fresh cluster');
}

await main();
