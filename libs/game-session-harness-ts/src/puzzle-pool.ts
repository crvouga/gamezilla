/**
 * A puzzle pool a scenario describes by what matters to it — each puzzle's
 * rating, popularity, times played and themes — made of the game's own
 * known puzzles, so every move on them is still its author's. The pool is
 * written through the catalogue's one way in (`admitCataloguePuzzle`), as
 * any game's import pipeline writes its puzzles, and the game's other known
 * puzzles leave it. And a person's earlier puzzle rating at a game.
 */

import {
  admitCataloguePuzzle,
  upsertCatalogueRows,
} from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import {
  inPuzzleNamespace,
  puzzleOwnerKey,
} from '@libs/game-puzzle-shared-ts/puzzle-namespace';
import { GAME_PUZZLE_SUB } from '@libs/game-puzzle-shared-ts/sub';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf, actorLocalSql } from '@libs/harness-ts/identity';
import { writeServerFixture } from '@libs/harness-ts/write-server-fixture';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { PuzzleRecord } from '@pkgs/turn-game-shared-ts/game-puzzles';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { HarnessGame } from './harness-game';
import { harnessGameOf } from './harness-game-of';
import { knownPuzzlesOf } from './puzzle-moves';

/**
 * One puzzle of a pool a scenario describes: a known puzzle of the game, by
 * id, with what the scenario says of it; the rest is its author's.
 */
export type PoolPuzzle = { readonly id: string } & Partial<
  Pick<PuzzleRecord, 'rating' | 'popularity' | 'plays' | 'themes'>
>;

/** The game's puzzle namespace (its share of the catalogue and profiles). */
export function puzzleNamespaceOfGame(game: HarnessGame): string {
  const puzzles = game.shared.turnGame.capabilities.puzzles;
  if (puzzles === undefined) throw new Error(`${game.label} offers no puzzles`);
  return puzzles.namespace;
}

/**
 * Make `gameId`'s pool exactly `pool`: each of its known puzzles, or of its
 * more puzzles (`fixtures.morePuzzles`), as `pool` describes it, and none of
 * the game's other known puzzles.
 */
export const writeKnownPuzzlePool = scenarioAction({
  name: 'writeKnownPuzzlePool',
  act: async (s, gameId: string, pool: readonly PoolPuzzle[]) => {
    const game = harnessGameOf(s, gameId);
    const known = knownPuzzlesOf(game);
    const authored = [...known, ...(game.fixtures.morePuzzles ?? [])];
    const turnGames = createTurnGames([game.shared.turnGame]);
    const rows = pool.map(({ id, ...described }) => {
      const record = authored.find(
        (fixture) => fixture.record.id === id
      )?.record;
      if (record === undefined)
        throw new Error(`${game.label} names no known puzzle ${id}`);
      const admission = admitCataloguePuzzle(turnGames, {
        record: { ...record, ...described },
        source: { url: null, tags: [] },
      });
      if (!admission.ok) throw new Error(admission.detail);
      return admission.row;
    });
    const kept = new Set(rows.map((row) => row.id));
    const at = new Date(s.harness.clock.now()).toISOString();
    await writeServerFixture(s, GAME_PUZZLE_SUB.topicMap, async (db) => {
      await upsertCatalogueRows(db, rows);
      for (const fixture of known) {
        const id = fixture.record.id;
        await db.run(sql`
          UPDATE chess_puzzles
          SET deleted_at = ${kept.has(id) ? null : at}, updated_at = ${at}
          WHERE id = ${id}
        `);
      }
    });
  },
});

/**
 * Add the first `count` of `gameId`'s more puzzles to its pool, as its
 * import pipeline would: a pool of more puzzles than its known ones.
 */
export const stockMorePuzzles = scenarioAction({
  name: 'stockMorePuzzles',
  act: async (s, gameId: string, count: number) => {
    const game = harnessGameOf(s, gameId);
    const more = game.fixtures.morePuzzles ?? [];
    if (more.length < count)
      throw new Error(
        `${game.label} names ${String(more.length)} more puzzles, not ${String(count)} (fixtures.morePuzzles)`
      );
    const turnGames = createTurnGames([game.shared.turnGame]);
    const rows = more.slice(0, count).map(({ record }) => {
      const admission = admitCataloguePuzzle(turnGames, {
        record,
        source: { url: null, tags: [] },
      });
      if (!admission.ok) throw new Error(admission.detail);
      return admission.row;
    });
    await writeServerFixture(s, GAME_PUZZLE_SUB.topicMap, (db) =>
      upsertCatalogueRows(db, rows)
    );
  },
});

/** How many of `namespace`'s puzzles the actor's device holds to serve. */
export async function countDevicePuzzles(
  s: ProductHarness,
  actorId: string,
  namespace: string
): Promise<number> {
  const db = actorLocalSql(s, actorId);
  if (db === null) return 0;
  const rows = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM chess_puzzles WHERE deleted_at IS NULL
  `);
  return rows.filter((row) => inPuzzleNamespace(row.id, namespace)).length;
}

/** What the catalogue says of `puzzleId`: its own rating and its themes. */
export async function readCataloguePuzzle(
  s: ProductHarness,
  puzzleId: string
): Promise<{ rating: number; themes: readonly string[] } | null> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    readonly rating: number;
    readonly themes: string;
  }>`
    SELECT rating, themes FROM chess_puzzles
    WHERE id = ${puzzleId} AND deleted_at IS NULL
  `);
  const row = rows[0];
  if (row === undefined) return null;
  const themes: unknown =
    typeof row.themes === 'string' ? JSON.parse(row.themes) : row.themes;
  return {
    rating: Number(row.rating),
    themes: Array.isArray(themes) ? themes.map(String) : [],
  };
}

/** A puzzle rating's Glicko-2 state, as earlier rated attempts left it. */
export type SeededPuzzleRating = {
  readonly rating: number;
  readonly ratingDeviation: number;
  readonly volatilityMicros: number;
};

/**
 * Give a signed-in actor an earlier puzzle rating at `gameId`'s puzzles, on
 * the server and in the device's synced copy, as if earlier rated attempts
 * had settled it there.
 */
export const seedPuzzleRating = scenarioAction({
  name: 'seedPuzzleRating',
  act: async (
    s,
    actorId: string,
    gameId: string,
    state: SeededPuzzleRating
  ) => {
    const owner = await accountIdOf(s, actorId);
    if (owner === null) throw new Error(`${actorId} is not signed in`);
    const device = actorLocalSql(s, actorId);
    if (device === null) throw new Error(`${actorId} has no device database`);
    const id = puzzleOwnerKey(
      puzzleNamespaceOfGame(harnessGameOf(s, gameId)),
      owner
    );
    const at = new Date(s.harness.clock.now()).toISOString();
    for (const db of [device, s.harness.serverSql.sqlClient]) {
      await db.run(sql`
        INSERT INTO chess_puzzle_profiles (
          id, owner_id, rating, rating_deviation, volatility_micros,
          last_interaction_at, created_at, updated_at, deleted_at
        ) VALUES (
          ${id}, ${owner}, ${state.rating}, ${state.ratingDeviation},
          ${state.volatilityMicros}, ${at}, ${at}, ${at}, NULL
        )
      `);
    }
  },
});

export const PUZZLE_POOL_ACTIONS = [
  writeKnownPuzzlePool,
  stockMorePuzzles,
  seedPuzzleRating,
];
