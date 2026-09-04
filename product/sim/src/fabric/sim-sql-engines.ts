/**
 * Sole engine selection point for sim SQL (playground + `@product/test`).
 * Product libs / createServer never import engines — only this fabric.
 */

import type { Clock } from '@pkgs/clock';
import type { SimCheckpointSqlFormat } from '@pkgs/sim-console/shared/sim-checkpoint';
import { resolveSimSqlBackend, type SimSqlBackend } from './sim-sql-backend';
import {
  MEM_CHECKPOINT_SQL_FORMAT,
  openMemClientSql,
  openMemServerSql,
  openMemServerSqlFromSeed,
} from './sim-sql-backend-mem';
import {
  openRealClientSql,
  openRealServerSql,
  openRealServerSqlFromSeed,
  REAL_CHECKPOINT_SQL_FORMAT,
} from './sim-sql-backend-real';
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

function createRealSqlEngines(): SimSqlEngines {
  return {
    id: 'real',
    checkpointSqlFormat: REAL_CHECKPOINT_SQL_FORMAT,
    async openServer(args) {
      const name = args.logicalName ?? 'sim_server';
      if (args.seedBytes !== undefined) {
        return openRealServerSqlFromSeed(name, args.clock, args.seedBytes);
      }
      return openRealServerSql(name, args.clock);
    },
    openClient(args) {
      return openRealClientSql(args.logicalName, args.clock);
    },
  };
}

let cached: SimSqlEngines | null = null;

/** Resolve once per process (env is stable for a sim run). */
export function getSimSqlEngines(): SimSqlEngines {
  if (cached !== null) return cached;
  const backend = resolveSimSqlBackend();
  cached = backend === 'mem' ? createMemSqlEngines() : createRealSqlEngines();
  return cached;
}

/** Tests only — clear fabric cache after mutating `SIM_SQL_BACKEND`. */
export function clearSimSqlEnginesCache(): void {
  cached = null;
}
