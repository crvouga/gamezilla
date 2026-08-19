/**
 * Idempotent bootstrap for `@pkgs/postgres-embedded`: ensure data dir + initdb when empty
 * or incomplete. The server itself is started by `dev` / `preview`.
 */
import {
  clusterLooksHealthy,
  createEmbeddedPostgres,
  DATA_DIR,
  ensureClusterInitialised,
} from '../src/cluster';

const pg = createEmbeddedPostgres();
if (clusterLooksHealthy()) {
  process.stdout.write(
    `[postgres] setup complete (existing cluster) ${DATA_DIR}\n`
  );
} else {
  await ensureClusterInitialised(pg);
  process.stdout.write(`[postgres] setup complete (initialised) ${DATA_DIR}\n`);
}
