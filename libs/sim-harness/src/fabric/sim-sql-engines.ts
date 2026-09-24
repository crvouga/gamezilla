/**
 * Sole engine selection point for sim SQL (product-simulator + `@apps/product`).
 * Product libs / createServer never import engines — only this fabric.
 *
 * Always mockingbird-postgres server + mockingbird-sqlite clients. Embedded Postgres is
 * wired only via fidelity-max hosts (`SIM_MODE=real`), not this fabric.
 */

import type { Clock } from '@pkgs/clock';
import type { SimCheckpointSqlFormat } from '@pkgs/sim-console/shared/sim-checkpoint';
import type { SimSqlBackend } from './sim-sql-backend';
import {
  MEM_CHECKPOINT_SQL_FORMAT,
  openMemClientSql,
  openMemServerSql,
  openMemServerSqlFromSeed,
} from './sim-sql-backend-mem';
import type { SimSql } from './sim-sql-types';

export type SimSqlEngines = {
  readonly id: SimSqlBackend;
  readonly checkpointSqlFormat: SimCheckpointSqlFormat;
  openServer(args: {
    clock: Clock;
    seedBytes?: Uint8Array;
    logicalName?: string;
  }): Promise<SimSql>;
  openClient(args: { logicalName: string; clock: Clock }): Promise<SimSql>;
};

function createMemSqlEngines(): SimSqlEngines {
  return {
    id: 'mem',
    checkpointSqlFormat: MEM_CHECKPOINT_SQL_FORMAT,
    async openServer(args) {
      const name = args.logicalName ?? 'sim_server';
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

let cached: SimSqlEngines | null = null;

/** Resolve once per process. */
export function getSimSqlEngines(): SimSqlEngines {
  if (cached !== null) return cached;
  cached = createMemSqlEngines();
  return cached;
}

/** Tests only — clear fabric cache between cases. */
export function clearSimSqlEnginesCache(): void {
  cached = null;
}
