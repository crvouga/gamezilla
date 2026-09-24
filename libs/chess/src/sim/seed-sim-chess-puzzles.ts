/**
 * Inserts the tiny DST chess-puzzle CSV into the live sim server DB.
 *
 * Not part of the PGMM dump: mockingbird-postgres snapshot round-trip corrupts
 * int8 column slots so `WHERE rating …` fails after import. Three rows are
 * cheap to insert on each {@link openSim}.
 *
 * Node-only (fixtures on disk). Callers must not import this from the web bundle.
 */

import { join } from 'node:path';
import { createLogger } from '@pkgs/logger';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createSimIds } from '@pkgs/uuid';
import { ChessPuzzleLoadFileSeeder } from '../root/server/seed-chess-puzzles/chess-puzzle-load-file-seeder';

const LOAD_FILE_KEY = 'chess-puzzles.sim.csv';

/** Fixed seed clock so rebuild dumps stay byte-stable. */
const SIM_CHESS_SEED_NOW_MS = 1_700_000_000_000;

export async function seedSimChessPuzzles(args: {
  readonly sqlClient: SqlClient;
}): Promise<void> {
  const fixturesDir = join(import.meta.dirname, '../../fixtures');
  const ids = createSimIds('sim-chess-puzzle-seed');
  const seeder = new ChessPuzzleLoadFileSeeder({
    loadFileStore: createNodeFsObjectStore({
      rootDir: fixturesDir,
      fs: wallNodeFs(),
      layout: 'tree',
    }),
    loadFileKey: LOAD_FILE_KEY,
    createId: ids.createId,
    now: () => SIM_CHESS_SEED_NOW_MS,
  });
  await seeder.seed({
    sqlClient: args.sqlClient,
    logger: createLogger({
      name: 'sim:seed-chess-puzzles',
      level: 'silent',
      now: () => SIM_CHESS_SEED_NOW_MS,
    }),
  });
}
