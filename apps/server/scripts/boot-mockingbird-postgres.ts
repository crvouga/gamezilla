// @io-wall-ok
/**
 * Hang with Mockingbird Postgres + product migrate/seed for CI (`check:api`).
 */

import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server/start';
import { runLocalMigrate } from './run-local-postgres-migrate';
import { runLocalSeed } from './run-local-postgres-seed';

const handle = await startMockingbirdPostgres();
await runLocalMigrate();
await runLocalSeed();
process.stdout.write('[postgres] ready (persistent)\n');

const stop = () => {
  void handle.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
await new Promise<void>(() => {
  // keep alive
});
