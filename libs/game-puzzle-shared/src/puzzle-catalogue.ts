/**
 * The puzzle catalogue's one way in. A game's import pipeline hands the
 * platform its puzzles; the platform admits a puzzle only into the
 * namespace of the game that recognises its position, only as that game's
 * `content.validate` accepts it, and keys its duplicates by the game's
 * `content.positionKey`. Only an admitted row can be written, and a write
 * outside a mutation wakes the catalogue topic its readers hold.
 */

import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql, { bulk } from '@pkgs/sql-root-shared/sql';
import type { PuzzleRecord } from '@pkgs/turn-game-shared/game-puzzles';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { puzzleNamespaceOf } from './puzzle-namespace';

/** A puzzle a game offers the catalogue, with where it came from. */
export type CataloguePuzzle = {
  readonly record: PuzzleRecord;
  /** The source game's link and opening tags, stored beside the puzzle. */
  readonly source: {
    readonly url: string | null;
    readonly tags: readonly string[];
  };
};

declare const admitted: unique symbol;

/** A `chess_puzzles` row, as only {@link admitCataloguePuzzle} makes one. */
export type CatalogueRow = {
  readonly id: string;
  readonly fen: string;
  readonly moves: string;
  readonly rating: number;
  readonly rating_deviation: number;
  readonly popularity: number;
  readonly nb_plays: number;
  readonly themes: string;
  readonly game_url: string | null;
  readonly opening_tags: string;
  readonly position_key: string;
  readonly [admitted]: true;
};

export type CatalogueAdmission =
  | { readonly ok: true; readonly row: CatalogueRow }
  | {
      readonly ok: false;
      readonly reason: 'namespace' | 'position' | 'content';
      readonly detail: string;
    };

/**
 * Admit `puzzle` into the catalogue of the registered `games`: its id's
 * namespace must be a game's puzzle namespace, that game must recognise
 * its position, and the game's `content.validate` must accept it.
 */
export function admitCataloguePuzzle(
  games: TurnGames,
  puzzle: CataloguePuzzle
): CatalogueAdmission {
  const { record } = puzzle;
  const namespace = puzzleNamespaceOf(record.id);
  const game = games.games.find(
    (registered) => registered.capabilities.puzzles?.namespace === namespace
  );
  const puzzles = game?.capabilities.puzzles;
  if (game === undefined || puzzles === undefined)
    return {
      ok: false,
      reason: 'namespace',
      detail: `${record.id}: no registered game offers puzzles in namespace "${namespace}"`,
    };
  if (!game.rules.recognizes(record.position))
    return {
      ok: false,
      reason: 'position',
      detail: `${record.id}: ${game.rules.id} does not recognise the position`,
    };
  const verdict = puzzles.content.validate(record);
  if (!verdict.ok)
    return {
      ok: false,
      reason: 'content',
      detail: `${record.id}: ${verdict.reason}: ${verdict.detail}`,
    };
  const row = {
    id: record.id,
    fen: record.position,
    moves: record.line.join(' '),
    rating: record.rating,
    rating_deviation: record.ratingDeviation,
    popularity: record.popularity,
    nb_plays: record.plays,
    themes: JSON.stringify(record.themes),
    game_url: puzzle.source.url,
    opening_tags: JSON.stringify(puzzle.source.tags),
    position_key:
      puzzles.content.positionKey?.(record) ??
      `${record.position} ${record.line.join(' ')}`,
  } as CatalogueRow;
  return { ok: true, row };
}

function values(rows: readonly CatalogueRow[]) {
  return rows.map((row) => [
    row.id,
    row.fen,
    row.moves,
    row.rating,
    row.rating_deviation,
    row.popularity,
    row.nb_plays,
    row.themes,
    row.game_url,
    row.opening_tags,
    row.position_key,
  ]);
}

/**
 * Insert or update admitted rows by id (an import that refreshes a source):
 * every column but the id takes the new value.
 */
export async function upsertCatalogueRows(
  tx: Pick<SqlTx, 'run'>,
  rows: readonly CatalogueRow[]
): Promise<void> {
  if (rows.length === 0) return;
  await tx.run(sql`
    INSERT INTO chess_puzzles (id, fen, moves, rating, rating_deviation, popularity,
      nb_plays, themes, game_url, opening_tags, position_key)
    VALUES ${bulk(values(rows))}
    ON CONFLICT (id) DO UPDATE SET fen = excluded.fen, moves = excluded.moves,
      rating = excluded.rating, rating_deviation = excluded.rating_deviation,
      popularity = excluded.popularity, nb_plays = excluded.nb_plays, themes = excluded.themes,
      game_url = excluded.game_url, opening_tags = excluded.opening_tags, position_key = excluded.position_key
  `);
}

/**
 * Insert admitted rows stamped `at`, leaving any row whose id or position
 * key is already stored (a bulk seed); the number inserted.
 */
export async function insertNewCatalogueRows(
  tx: Pick<SqlTx, 'run'>,
  rows: readonly CatalogueRow[],
  at: string
): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await tx.run(sql<void>`
    INSERT INTO chess_puzzles (
      id,
      created_at,
      updated_at,
      fen,
      moves,
      rating,
      rating_deviation,
      popularity,
      nb_plays,
      themes,
      game_url,
      opening_tags,
      position_key
    )
    VALUES ${bulk(
      rows.map((row) => {
        const [id, ...rest] = values([row])[0]!;
        return [id, at, at, ...rest];
      })
    )}
    ON CONFLICT DO NOTHING
  `);
  return result.changes;
}

/**
 * Broadcast topic of the puzzle catalogue, every game's puzzles in one
 * stream (its name predates the other games and is kept).
 */
export function puzzleCatalogueTopic(): Topic {
  return 'system:chess_puzzles';
}

export function puzzleCatalogueChannels(): Topic[] {
  return [puzzleCatalogueTopic()];
}
