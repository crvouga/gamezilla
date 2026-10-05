/**
 * Inserts the tiny DST chess-puzzle CSV into the live harness server DB.
 *
 * Not part of the PGMM dump: mockingbird-postgres snapshot round-trip corrupts
 * int8 column slots so `WHERE rating …` fails after import. Three rows are
 * cheap to insert on each {@link openHarness}.
 *
 * Node-only (fixtures on disk). Callers must not import this from the web bundle.
 */

import { join } from 'node:path';
import { ChessPuzzleLoadFileSeeder } from '@libs/chess-puzzle-server/chess-puzzle-load-file-seeder';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { createHarnessIds } from '@pkgs/uuid-shared/seeded-create-id';

const LOAD_FILE_KEY = 'chess-puzzles.harness.csv';

/**
 * A feed-sized pool on top of the three documented puzzles: 32 distinct
 * puzzles rated 1300 to 1672 (under the 1700 a custom 1600 target may pick
 * up to), less popular than every other fixture so a scenario's named
 * puzzles still come first, and carrying only the `middlegame` theme so no
 * named puzzle's theme matches them. Enough for days of play on one device.
 */
export const HARNESS_CHESS_FEED_POOL_KEY = 'chess-puzzles-pool.harness.csv';

/** The feed pool's puzzle ids, `pool01` … `pool32`. */
export const HARNESS_CHESS_FEED_POOL_IDS: readonly string[] = Array.from(
  { length: 32 },
  (_, index) => `pool${String(index + 1).padStart(2, '0')}`
);

/** Fixed seed clock so rebuild dumps stay byte-stable. */
const HARNESS_CHESS_SEED_NOW_MS = 1_700_000_000_000;

export async function seedHarnessChessPuzzles(args: {
  readonly sqlClient: SqlClient;
  /** Which fixture under `libs/chess-puzzle-harness/fixtures/` (default: the three). */
  readonly loadFileKey?: string;
}): Promise<void> {
  const fixturesDir = join(import.meta.dirname, '../fixtures');
  const loadFileKey = args.loadFileKey ?? LOAD_FILE_KEY;
  // One id namespace per fixture, so two seeded fixtures never collide.
  const ids = createHarnessIds(
    loadFileKey === LOAD_FILE_KEY
      ? 'harness-chess-puzzle-seed'
      : `harness-chess-puzzle-seed:${loadFileKey}`
  );
  const seeder = new ChessPuzzleLoadFileSeeder({
    loadFileStore: createNodeFsObjectStore({
      rootDir: fixturesDir,
      fs: wallNodeFs(),
      layout: 'tree',
    }),
    loadFileKey,
    createId: ids.createId,
    now: () => HARNESS_CHESS_SEED_NOW_MS,
  });
  await seeder.seed({
    sqlClient: args.sqlClient,
    logger: createLogger({
      name: 'harness:seed-chess-puzzles',
      level: 'silent',
      now: () => HARNESS_CHESS_SEED_NOW_MS,
    }),
  });
}
