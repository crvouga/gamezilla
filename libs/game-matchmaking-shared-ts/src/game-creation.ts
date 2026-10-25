import { telemetrySubjectId } from '@libs/observability-shared-ts/domain-event';
import { changeAvailabilities } from '@pkgs/matchmaking-sql-shared-ts/owner-repository';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import {
  gameSides,
  type TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { MultiplayerGame } from './game-state';
import { matchChoiceOf } from './match-choice';
import { scheduleMultiplayerDeadline } from './multiplayer-deadline';
import { dealMultiplayerHands } from './multiplayer-hands';
import { scheduleMultiplayerNotices } from './multiplayer-notices';
import { formatMultiplayerRating } from './multiplayer-rating';
import { multiplayerPeople } from './multiplayer-roster';
import { initialSetupReady } from './multiplayer-setup';
import { publishMatchGame } from './publish-match-game';
import { MultiplayerRatingRepository } from './rating-repository';
import { gameCreatedEvent } from './telemetry';
import { startingMs, timeControlOf } from './time-control';

export type NewMultiplayerGame = {
  readonly id: string;
  readonly whiteId: string;
  readonly blackId: string;
  readonly redId?: string;
  readonly blueId?: string;
  readonly timeControl: string;
  readonly rematchOf: string | null;
  readonly nowMs: number;
  readonly createId?: () => string;
  readonly initialPosition?: string;
};

async function shownRatings(
  tx: SqlTx,
  input: NewMultiplayerGame
): Promise<ReadonlyMap<string, string>> {
  const control = matchChoiceOf(input.timeControl);
  if (control === null) return new Map();
  const people = [
    input.whiteId,
    input.blackId,
    input.redId,
    input.blueId,
  ].filter((person): person is string => Boolean(person));
  const ratings = await new MultiplayerRatingRepository(tx).readMany(
    people,
    control.ratingPool
  );
  return new Map(
    [...ratings].map(([owner, rating]) => [
      owner,
      formatMultiplayerRating(rating),
    ])
  );
}

/**
 * Starts one multiplayer game: White to move, both clocks full, White's 30
 * seconds for the first move running. Both people become its current game
 * and leave matchmaking until it ends.
 */
async function initialMultiplayerGame(
  tx: SqlTx,
  input: NewMultiplayerGame,
  rules: TurnGames
): Promise<MultiplayerGame> {
  requirePlayers(input, rules);
  const gameRules = rules.forControl(input.timeControl);
  const simulation = rules.simulation(gameRules.id);
  const turns = rules.turnsForPosition(gameRules.initial()) !== undefined;
  const timed = turns && timeControlOf(input.timeControl) !== null;
  const ms = timed ? startingMs(input.timeControl) : null;
  const position =
    input.initialPosition ??
    (simulation === undefined
      ? gameRules.initial()
      : simulation.codec.encode(simulation.initialize(input.id)));
  if (
    !gameRules.recognizes(position) ||
    (simulation !== undefined && simulation.codec.decode(position) === null)
  )
    throw new Error('invalid initial multiplayer position');
  const ratings = await shownRatings(tx, input);
  const game: MultiplayerGame = {
    id: input.id,
    white_id: input.whiteId,
    black_id: input.blackId,
    red_id: input.redId ?? null,
    blue_id: input.blueId ?? null,
    fen: position,
    pgn: '',
    revision: 0,
    turn: turns ? input.whiteId : '',
    outcome: 'ongoing',
    reason: null,
    time_control: input.timeControl,
    white_ms: ms,
    black_ms: ms,
    red_ms: input.redId ? ms : null,
    blue_ms: input.blueId ? ms : null,
    clock_at_ms: timed ? input.nowMs : null,
    paused_at_ms: null,
    draw_offer_by: '',
    rematch_offer_by: '',
    draw_votes: null,
    rematch_votes: null,
    rematch_of: input.rematchOf,
    white_rating: ratings.get(input.whiteId) ?? '',
    black_rating: ratings.get(input.blackId) ?? '',
    red_rating: input.redId ? (ratings.get(input.redId) ?? '') : null,
    blue_rating: input.blueId ? (ratings.get(input.blueId) ?? '') : null,
    white_rating_diff: null,
    black_rating_diff: null,
    red_rating_diff: null,
    blue_rating_diff: null,
    setup_ready: initialSetupReady(rules, input.timeControl),
  };
  return game;
}

function requirePlayers(input: NewMultiplayerGame, rules: TurnGames): void {
  const declared = gameSides(rules.forControl(input.timeControl));
  const supplied = {
    white: input.whiteId,
    black: input.blackId,
    red: input.redId,
    blue: input.blueId,
  };
  const people = declared.map((side) => supplied[side]);
  if (
    people.some((person) => !person) ||
    new Set(people).size !== declared.length ||
    Object.entries(supplied).some(
      ([side, person]) =>
        person && !declared.includes(side as (typeof declared)[number])
    )
  )
    throw new MutationError(
      'GAME_PLAYER_COUNT',
      'Fill every required place with a different person.'
    );
}

async function insertGame(
  tx: SqlTx,
  game: MultiplayerGame,
  nowMs: number
): Promise<void> {
  const iso = new Date(nowMs).toISOString();
  await tx.run(sql`INSERT INTO chess_multiplayer_games
    (id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason, time_control,
      white_ms, black_ms, clock_at_ms, paused_at_ms, draw_offer_by, rematch_offer_by, rematch_of, white_rating,
      black_rating, white_rating_diff, black_rating_diff, red_id, blue_id, red_ms, blue_ms, red_rating, blue_rating, red_rating_diff, blue_rating_diff, draw_votes, rematch_votes, setup_ready, created_at, updated_at, deleted_at)
    VALUES (${game.id}, ${game.id}, ${game.white_id}, ${game.black_id}, ${game.fen}, ${game.pgn},
      ${game.revision}, ${game.turn}, ${game.outcome}, ${game.reason}, ${game.time_control},
      ${game.white_ms}, ${game.black_ms}, ${game.clock_at_ms}, ${game.paused_at_ms}, ${game.draw_offer_by},
      ${game.rematch_offer_by}, ${game.rematch_of}, ${game.white_rating}, ${game.black_rating},
      ${null}, ${null}, ${game.red_id}, ${game.blue_id}, ${game.red_ms}, ${game.blue_ms}, ${game.red_rating}, ${game.blue_rating}, ${null}, ${null}, ${null}, ${null}, ${game.setup_ready}, ${iso}, ${iso}, ${null})`);
}

/** Fills the declared seats atomically and publishes the one authoritative game. */
export async function createMultiplayerGame(
  tx: SqlTx,
  input: NewMultiplayerGame,
  rules: TurnGames
): Promise<void> {
  const game = await initialMultiplayerGame(tx, input, rules);
  await insertGame(tx, game, input.nowMs);
  await dealMultiplayerHands(tx, game, {
    rules,
    createId: input.createId,
    nowMs: input.nowMs,
  });
  const iso = new Date(input.nowMs).toISOString();
  const people = multiplayerPeople(game);
  await tx.run(sql`INSERT INTO chess_multiplayer_players (id, owner_id, game_id, created_at, updated_at, deleted_at)
    VALUES ${join(people.map((ownerId) => sql`(${ownerId}, ${ownerId}, ${game.id}, ${iso}, ${iso}, ${null})`))}
    ON CONFLICT (id) DO UPDATE SET game_id = excluded.game_id, updated_at = excluded.updated_at`);
  await changeAvailabilities(tx, {
    ownerIds: people,
    available: false,
    nowMs: input.nowMs,
  });
  await scheduleMultiplayerDeadline(tx, game, input.nowMs);
  await scheduleMultiplayerNotices(
    tx,
    { before: null, after: game },
    input.nowMs
  );
  await announceGame(tx, game, input);
  if (input.createId !== undefined)
    await publishMatchGame(
      {
        tx,
        env: { now: () => new Date(input.nowMs), createId: input.createId },
      },
      game
    );
}

async function announceGame(
  tx: SqlTx,
  game: MultiplayerGame,
  input: NewMultiplayerGame
): Promise<void> {
  await gameCreatedEvent.outbox.enqueue(
    {
      tx,
      env: {
        now: () => new Date(input.nowMs),
        createId: () => input.id,
      },
    },
    {
      attributes: {
        'game.id': game.id,
        'game.mode': 'multiplayer',
        ...(game.time_control === null
          ? {}
          : { 'game.time_control': game.time_control }),
        'participant.white.id': telemetrySubjectId(
          `subject.id:${game.white_id}`
        ),
        ...(game.red_id
          ? {
              'participant.red.id': telemetrySubjectId(
                `subject.id:${game.red_id}`
              ),
            }
          : {}),
        ...(game.blue_id
          ? {
              'participant.blue.id': telemetrySubjectId(
                `subject.id:${game.blue_id}`
              ),
            }
          : {}),
        'participant.black.id': telemetrySubjectId(
          `subject.id:${game.black_id}`
        ),
      },
      envelope: { id: game.id, occurredAtMs: input.nowMs },
    }
  );
}
