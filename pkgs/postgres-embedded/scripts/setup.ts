/**
 * Idempotent bootstrap for `@pkgs/postgres-embedded`: ensure data dir + initdb when empty
 * or incomplete. The server itself is started by `dev` / `preview`.
 */
import {
  clusterLooksHealthy,
  createEmbeddedPostgres,
  defaultClusterConfig,
  ensureClusterInitialised,
} from '../src/cluster';

const config = defaultClusterConfig();
const pg = createEmbeddedPostgres(config);
if (clusterLooksHealthy(config)) {
  process.stdout.write(
    `[postgres] setup complete (existing cluster) ${config.dataDir}\n`
  );
} else {
  await ensureClusterInitialised(pg, config);
  process.stdout.write(
    `[postgres] setup complete (initialised) ${config.dataDir}\n`
  );
}
