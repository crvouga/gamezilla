/**
 * Sole engine selection point for harness SQL (product-harness + `@apps/product`).
 * Product libs / createServer never import engines — only this fabric.
 *
 * Always mockingbird-postgres server + mockingbird-sqlite clients. Embedded Postgres is
 * wired only via fidelity-max hosts (`HARNESS_MODE=real`), not this fabric.
 */

import type { Clock } from '@pkgs/clock';
import type { HarnessCheckpointSqlFormat } from '@pkgs/harness-console/shared/harness-checkpoint';
import type { HarnessSqlBackend } from './harness-sql-backend';
import {
  MEM_CHECKPOINT_SQL_FORMAT,
  openMemClientSql,
  openMemServerSql,
  openMemServerSqlFromSeed,
} from './harness-sql-backend-mem';
import type { HarnessSql } from './harness-sql-types';

export type HarnessSqlEngines = {
  readonly id: HarnessSqlBackend;
  readonly checkpointSqlFormat: HarnessCheckpointSqlFormat;
  openServer(args: {
    clock: Clock;
    seedBytes?: Uint8Array;
    logicalName?: string;
  }): Promise<HarnessSql>;
  openClient(args: { logicalName: string; clock: Clock }): Promise<HarnessSql>;
};

function createMemSqlEngines(): HarnessSqlEngines {
  return {
    id: 'mem',
    checkpointSqlFormat: MEM_CHECKPOINT_SQL_FORMAT,
    async openServer(args) {
      const name = args.logicalName ?? 'harness_server';
      if (args.seedBytes !== undefined) {
        return openMemServerSqlFromSeed(name, args.clock, args.seedBytes);
      }
      const handle = openMemServerSql(name, args.clock);
      await handle.sqlClient.connect();
      return handle;
    },
    async openClient(args) {
      const handle = openMemClientSql(args.logicalName, args.clock);
      await handle.sqlClient.connect();
      return handle;
    },
  };
}

let cached: HarnessSqlEngines | null = null;

/** Resolve once per process. */
export function getHarnessSqlEngines(): HarnessSqlEngines {
  if (cached !== null) return cached;
  cached = createMemSqlEngines();
  return cached;
}

/** Tests only — clear fabric cache between cases. */
export function clearHarnessSqlEnginesCache(): void {
  cached = null;
}
