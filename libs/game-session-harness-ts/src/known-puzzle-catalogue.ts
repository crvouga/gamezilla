/**
 * A world's puzzle catalogue holding each game's known puzzles, written
 * through the catalogue's one way in (`admitCataloguePuzzle`), as any
 * game's import pipeline writes its puzzles.
 */

import {
  admitCataloguePuzzle,
  insertNewCatalogueRows,
} from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { HarnessGame } from './harness-game';

/** When the known puzzles entered the catalogue: fixed, so seeds are stable. */
const SEEDED_AT = new Date(1_700_000_000_000).toISOString();

/** Write every one of `games`' known puzzles into the catalogue. */
export async function seedKnownPuzzles(
  sqlClient: SqlClient,
  turnGames: TurnGames,
  games: readonly HarnessGame[]
): Promise<void> {
  const rows = games.flatMap((game) =>
    (game.fixtures.puzzles ?? []).map((fixture) => {
      const admission = admitCataloguePuzzle(turnGames, {
        record: fixture.record,
        source: { url: null, tags: [] },
      });
      if (!admission.ok) throw new Error(`${game.label}: ${admission.detail}`);
      return admission.row;
    })
  );
  await insertNewCatalogueRows(sqlClient, rows, SEEDED_AT);
}
