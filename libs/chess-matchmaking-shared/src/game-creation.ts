import { telemetrySubjectId } from '@libs/observability-shared/domain-event';
import { changeAvailability } from '@pkgs/matchmaking-sql-shared/owner-repository';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { Chess } from 'chess.js';
import type { MultiplayerGame } from './game-state';
import { scheduleMultiplayerDeadline } from './multiplayer-deadline';
import { scheduleMultiplayerNotices } from './multiplayer-notices';
import { formatMultiplayerRating } from './multiplayer-rating';
import { publishMatchGame } from './publish-match-game';
import { MultiplayerRatingRepository } from './rating-repository';
import { gameCreatedEvent } from './telemetry';
import { startingMs, timeControlOf } from './time-control';

export type NewMultiplayerGame = {
  readonly id: string;
  readonly whiteId: string;
  readonly blackId: string;
  readonly timeControl: string;
  readonly rematchOf: string | null;
  readonly nowMs: number;
  readonly createId?: () => string;
};

async function shownRating(
  tx: SqlTx,
  ownerId: string,
  timeControl: string
): Promise<string> {
  const control = timeControlOf(timeControl);
  if (control === null) return '';
  return formatMultiplayerRating(
    await new MultiplayerRatingRepository(tx).read(ownerId, control.speed)
  );
}

/**
 * Starts one multiplayer game: White to move, both clocks full, White's 30
 * seconds for the first move running. Both people become its current game
 * and leave matchmaking until it ends.
 */
export async function createMultiplayerGame(
  tx: SqlTx,
  input: NewMultiplayerGame
): Promise<void> {
  const iso = new Date(input.nowMs).toISOString();
  const ms = startingMs(input.timeControl);
  const game: MultiplayerGame = {
    id: input.id,
    white_id: input.whiteId,
    black_id: input.blackId,
    fen: new Chess().fen(),
    pgn: '',
    revision: 0,
    turn: input.whiteId,
    outcome: 'ongoing',
    reason: null,
    time_control: input.timeControl,
    white_ms: ms,
    black_ms: ms,
    clock_at_ms: input.nowMs,
    paused_at_ms: null,
    draw_offer_by: '',
    rematch_offer_by: '',
    rematch_of: input.rematchOf,
    white_rating: await shownRating(tx, input.whiteId, input.timeControl),
    black_rating: await shownRating(tx, input.blackId, input.timeControl),
    white_rating_diff: null,
    black_rating_diff: null,
  };
  await tx.run(sql`INSERT INTO chess_multiplayer_games
    (id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason, time_control,
      white_ms, black_ms, clock_at_ms, paused_at_ms, draw_offer_by, rematch_offer_by, rematch_of, white_rating,
      black_rating, white_rating_diff, black_rating_diff, created_at, updated_at, deleted_at)
    VALUES (${game.id}, ${game.id}, ${game.white_id}, ${game.black_id}, ${game.fen}, ${game.pgn},
      ${game.revision}, ${game.turn}, ${game.outcome}, ${game.reason}, ${game.time_control},
      ${game.white_ms}, ${game.black_ms}, ${game.clock_at_ms}, ${game.paused_at_ms}, ${game.draw_offer_by},
      ${game.rematch_offer_by}, ${game.rematch_of}, ${game.white_rating}, ${game.black_rating},
      ${null}, ${null}, ${iso}, ${iso}, ${null})`);
  for (const ownerId of [input.whiteId, input.blackId]) {
    await tx.run(sql`INSERT INTO chess_multiplayer_players (id, owner_id, game_id, created_at, updated_at, deleted_at)
      VALUES (${ownerId}, ${ownerId}, ${game.id}, ${iso}, ${iso}, ${null})
      ON CONFLICT (id) DO UPDATE SET game_id = excluded.game_id, updated_at = excluded.updated_at`);
    await changeAvailability(tx, {
      ownerId,
      available: false,
      nowMs: input.nowMs,
    });
  }
  await scheduleMultiplayerDeadline(tx, game, input.nowMs);
  await scheduleMultiplayerNotices(
    tx,
    { before: null, after: game },
    input.nowMs
  );
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
        'participant.white.id': telemetrySubjectId(
          `subject.id:${game.white_id}`
        ),
        'participant.black.id': telemetrySubjectId(
          `subject.id:${game.black_id}`
        ),
      },
      envelope: { id: game.id, occurredAtMs: input.nowMs },
    }
  );
  if (input.createId !== undefined)
    await publishMatchGame(
      {
        tx,
        env: { now: () => new Date(input.nowMs), createId: input.createId },
      },
      game
    );
}
