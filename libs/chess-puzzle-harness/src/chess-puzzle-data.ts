/**
 * Puzzle-content stimuli and reads for the §4 / §23 ingest scenarios: ingest
 * a CSV into the harness server through the real load-file seeder (validation +
 * dedupe), read stored / synced puzzle rows, and read the board orientation
 * the play screen renders.
 */

import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql } from '@libs/harness/identity';
import { Handles } from '@libs/test-ids-shared/handles';
import { createLogger } from '@pkgs/logger-shared/logger';
import { writeUtf8 } from '@pkgs/object-store-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-shared/impl-in-memory';
import sql from '@pkgs/sql-shared/sql';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import { ChessPuzzleLoadFileSeeder } from '@libs/chess-puzzle-server/chess-puzzle-load-file-seeder';

const INGEST_KEY = 'ingest.csv';

export type StoredPuzzleRow = {
  readonly id: string;
  readonly fen: string;
  readonly moves: string;
  readonly rating: number;
  readonly rating_deviation: number;
  readonly popularity: number;
  readonly nb_plays: number;
  readonly themes: unknown;
  readonly game_url: string | null;
  readonly opening_tags: unknown;
};

/** Seeds `csv` (Lichess or load-file shape) into the server database. */
export const ingestChessPuzzleCsv = scenarioAction({
  name: 'ingestChessPuzzleCsv',
  act: async (s, csv: string) => {
    const store = new ObjectStoreImplInMemory();
    await writeUtf8(store, INGEST_KEY, csv, 'text/csv');
    const now = () => s.harness.clock.now();
    await new ChessPuzzleLoadFileSeeder({
      loadFileStore: store,
      loadFileKey: INGEST_KEY,
      createId: s.harness.server.createId,
      now,
    }).seed({
      sqlClient: s.harness.serverSql.sqlClient,
      logger: createLogger({ name: 'harness:ingest', level: 'silent', now }),
    });
  },
});

function selectPuzzles(db: Pick<SqlTx, 'query'>): Promise<StoredPuzzleRow[]> {
  return db.query(sql<StoredPuzzleRow>`
    SELECT id, fen, moves, rating, rating_deviation, popularity, nb_plays,
      themes, game_url, opening_tags
    FROM chess_puzzles
    WHERE deleted_at IS NULL
    ORDER BY id ASC
  `);
}

/** Every live puzzle row on the server. */
export function readServerPuzzles(
  s: ProductHarness
): Promise<StoredPuzzleRow[]> {
  return selectPuzzles(s.harness.serverSql.sqlClient);
}

/** Every live puzzle row synced into the actor's local database. */
export async function readLocalPuzzles(
  s: ProductHarness,
  actorId: string
): Promise<StoredPuzzleRow[]> {
  const db = actorLocalSql(s, actorId);
  return db === null ? [] : selectPuzzles(db);
}

/** Orientation probe of the puzzle board (`white` / `black`), or null. */
export async function readPuzzleBoardOrientation(
  s: ProductHarness,
  actorId: string
): Promise<'white' | 'black' | null> {
  try {
    const ui = await actorUi(s, actorId);
    const text = (
      (await ui.get(Handles.chessPuzzleBoardOrientation).text()) ?? ''
    )
      .replace(/\u200b/g, '')
      .trim();
    return text === 'white' || text === 'black' ? text : null;
  } catch {
    return null;
  }
}

/**
 * §34 "puzzle retired after being prefetched". Retirement is a soft delete on
 * the catalog row (domain rows are never hard-deleted), which takes the
 * puzzle out of every feed and pick read. The tombstone reaches the client
 * through the ordinary snapshot path when its pool subscription re-hydrates.
 */
export const retireChessPuzzle = scenarioAction({
  name: 'retireChessPuzzle',
  act: async (s, puzzleId: string) => {
    await s.harness.serverSql.sqlClient.run(sql`
      UPDATE chess_puzzles
      SET deleted_at = ${new Date(s.harness.clock.now()).toISOString()}
      WHERE id = ${puzzleId}
    `);
  },
});

/** §34 "puzzle edited after being prefetched": the catalog rating moves. */
export const editChessPuzzleRating = scenarioAction({
  name: 'editChessPuzzleRating',
  act: async (s, puzzleId: string, rating: number) => {
    await s.harness.serverSql.sqlClient.run(sql`
      UPDATE chess_puzzles
      SET rating = ${rating}
      WHERE id = ${puzzleId}
    `);
  },
});

export type LocalPuzzleRow = {
  readonly fen: string;
  readonly moves: string;
  readonly deleted: boolean;
};

/** The actor's own local copy of one puzzle row, tombstones included. */
export async function readLocalPuzzleRow(
  s: ProductHarness,
  actorId: string,
  puzzleId: string
): Promise<LocalPuzzleRow | null> {
  const db = actorLocalSql(s, actorId);
  if (db === null) return null;
  const rows = await db.query(sql<{
    readonly fen: string;
    readonly moves: string;
    readonly deleted_at: string | null;
  }>`
    SELECT fen, moves, deleted_at
    FROM chess_puzzles
    WHERE id = ${puzzleId}
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    fen: row.fen,
    moves: row.moves,
    deleted: row.deleted_at !== null,
  };
}
