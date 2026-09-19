/**
 * Puzzle-content stimuli and reads for the §4 / §23 ingest scenarios: ingest
 * a CSV into the sim server through the real load-file seeder (validation +
 * dedupe), read stored / synced puzzle rows, and read the board orientation
 * the play screen renders.
 */
import { ChessPuzzleLoadFileSeeder } from '@libs/chess/root/server/seed-chess-puzzles/chess-puzzle-load-file-seeder';
import { Handles } from '@libs/test-ids';
import { createLogger } from '@pkgs/logger';
import { writeUtf8 } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

import { actorUi, scenarioAction } from './actor-ui';
import { actorLocalSql } from './identity';
import type { ProductSim } from './sim';

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
    const now = () => s.sim.clock.now();
    await new ChessPuzzleLoadFileSeeder({
      loadFileStore: store,
      loadFileKey: INGEST_KEY,
      createId: s.sim.server.createId,
      now,
    }).seed({
      sqlClient: s.sim.serverSql.sqlClient,
      logger: createLogger({ name: 'sim:ingest', level: 'silent', now }),
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
export function readServerPuzzles(s: ProductSim): Promise<StoredPuzzleRow[]> {
  return selectPuzzles(s.sim.serverSql.sqlClient);
}

/** Every live puzzle row synced into the actor's local database. */
export async function readLocalPuzzles(
  s: ProductSim,
  actorId: string
): Promise<StoredPuzzleRow[]> {
  const db = actorLocalSql(s, actorId);
  return db === null ? [] : selectPuzzles(db);
}

/** Orientation probe of the puzzle board (`white` / `black`), or null. */
export async function readPuzzleBoardOrientation(
  s: ProductSim,
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
