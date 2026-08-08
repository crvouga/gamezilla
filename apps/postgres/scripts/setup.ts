/**
 * Idempotent bootstrap for `@apps/postgres`: ensure data dir + initdb when empty.
 * The server itself is started by `dev` / `preview`.
 */
import {
  clusterAlreadyInitialised,
  createEmbeddedPostgres,
  DATA_DIR,
  ensureClusterInitialised,
} from './cluster';

const pg = createEmbeddedPostgres();
if (clusterAlreadyInitialised()) {
  process.stdout.write(
    `[postgres] setup complete (existing cluster) ${DATA_DIR}\n`
  );
} else {
  await ensureClusterInitialised(pg);
  process.stdout.write(`[postgres] setup complete (initialised) ${DATA_DIR}\n`);
}
