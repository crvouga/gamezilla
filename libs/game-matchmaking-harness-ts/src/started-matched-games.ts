/**
 * The matched games a person already started, set up where playing each one
 * through would take a scenario too long: each is stored as the matched game
 * it was, started at the given instant against a stand-in opponent and since
 * drawn by agreement, so it is over and only counts toward the daily matched
 * game limit. The person takes the second side first and then alternates,
 * so the earlier games never leave them owed the second side next.
 * Written through the framework's own fixture transaction.
 */

import { scenarioAction } from '@libs/harness-ts/actor-ui';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { multiplayerFixture } from './multiplayer-fixtures-core';

export type StartedMatchedGames = {
  /** How many matched games were started. */
  readonly count: number;
  /** The game's starting position (which game they were of). */
  readonly fen: string;
  /** The instant every one of them started. */
  readonly atMs: number;
};

export const givenStartedMatchedGames = scenarioAction({
  name: 'givenStartedMatchedGames',
  act: (s, actor: string, started: StartedMatchedGames) =>
    multiplayerFixture(s, actor, async (tx, env) => {
      const iso = new Date(started.atMs).toISOString();
      for (let index = 0; index < started.count; index += 1) {
        const id = env.createId();
        const opponent = `stand-in-${String(index)}`;
        const [white, black] =
          index % 2 === 0 ? [opponent, env.actorId] : [env.actorId, opponent];
        await tx.run(sql`INSERT INTO chess_multiplayer_games
          (id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason, time_control,
            white_ms, black_ms, clock_at_ms, paused_at_ms, draw_offer_by, rematch_offer_by, rematch_of,
            white_rating, black_rating, white_rating_diff, black_rating_diff, red_id, blue_id, red_ms, blue_ms,
            red_rating, blue_rating, red_rating_diff, blue_rating_diff, draw_votes, rematch_votes, setup_ready,
            created_at, updated_at, deleted_at)
          VALUES (${id}, ${id}, ${white}, ${black}, ${started.fen}, ${''},
            ${0}, ${''}, ${'draw'}, ${'agreement'}, ${null},
            ${null}, ${null}, ${null}, ${null}, ${''}, ${''}, ${null},
            ${null}, ${null}, ${null}, ${null}, ${null}, ${null}, ${null}, ${null},
            ${null}, ${null}, ${null}, ${null}, ${null}, ${null}, ${null},
            ${iso}, ${iso}, ${null})`);
      }
      return [env.actorId];
    }),
});

const DAY_MS = 86_400_000;

/** UTC midnight that began the scenario's day: the first instant of "today". */
export function startOfToday(s: {
  readonly harness: { readonly clock: { now(): number } };
}): number {
  return Math.floor(s.harness.clock.now() / DAY_MS) * DAY_MS;
}
