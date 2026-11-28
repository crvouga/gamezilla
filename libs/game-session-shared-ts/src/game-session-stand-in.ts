import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import {
  CancelScheduleEffect,
  ROOM_SCHEDULER_IDENTITY,
  ScheduleEffect,
} from '@pkgs/room-root-shared-ts/builtin';
import type {
  HandleResult,
  RoomEffect,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  GameSessionAbsenceAttr,
  gameSessionAwaySince,
} from './game-session-absence';
import {
  GameSessionsChanged,
  StandInGameSession,
} from './game-session-commands';
import { GAME_SESSION_AWAY_CLAIM_MS } from './game-session-refusal';
import { changedGameSessions, refuseGameSession } from './game-session-result';
import type { GameSession, GameSessionSide } from './game-session-state';
import { GameSessionsAttr } from './game-session-state';

/**
 * Stand-ins: in a game session of more than two sides, a participant away for
 * the away grace period no longer holds everyone up. A disclosed stand-in
 * bot plays their side, with their side's private setup and nothing more,
 * until they take it back (`reclaim`). Their side, readiness and result
 * stay theirs; only who decides for the side changes. A two-sided game keeps
 * its own policy: the other participant may claim the win instead.
 */

const STAND_IN_SCHEDULE = 'chess-custom:stand-in';
/** How long a participant stays away before a stand-in plays their side. */
export const GAME_SESSION_STAND_IN_MS = GAME_SESSION_AWAY_CLAIM_MS;

/** Whether a person here plays `side` themselves. */
function playedByPersonHere(
  state: RoomState,
  game: GameSession,
  side: GameSessionSide
): boolean {
  return (
    game[side].kind === 'person' &&
    !game.standIns.includes(side) &&
    gameSessionAwaySince(state, game[side].person) === null
  );
}

/**
 * The sides of people away from `game`, with when their grace period ends.
 * Nobody gets a stand-in while the host is away (the game is paused, and a
 * pause never counts as time away), nor without another person here whom
 * the absence holds up.
 */
function awayDeadlines(
  state: RoomState,
  game: GameSession,
  rules: TurnGames
): readonly { readonly side: GameSessionSide; readonly at: number }[] {
  if (game.status !== 'active' || game.sides.length <= 2) return [];
  if (!rules.offers(rules.forPosition(game.fen).id, 'vs-bot')) return [];
  if (GameSessionAbsenceAttr.from(state).pausedAt !== null) return [];
  return game.sides.flatMap((side) => {
    if (game[side].kind !== 'person' || game.standIns.includes(side)) return [];
    const since = gameSessionAwaySince(state, game[side].person);
    if (since === null) return [];
    const heldUp = game.sides.some(
      (other) => other !== side && playedByPersonHere(state, game, other)
    );
    return heldUp ? [{ side, at: since + GAME_SESSION_STAND_IN_MS }] : [];
  });
}

/** The room's next stand-in wake for `game`, or none. */
export function gameSessionStandInEffects(
  state: RoomState,
  game: GameSession | null,
  rules: TurnGames
): readonly RoomEffect[] {
  const deadlines = game === null ? [] : awayDeadlines(state, game, rules);
  if (game === null || deadlines.length === 0)
    return [CancelScheduleEffect({ id: STAND_IN_SCHEDULE })];
  return [
    ScheduleEffect({
      id: STAND_IN_SCHEDULE,
      at: Math.min(...deadlines.map((deadline) => deadline.at)),
      payload: StandInGameSession({ gameId: game.id }),
    }),
  ];
}

/**
 * `result` with the stand-in wake its game session now needs: every change of
 * the game, and every change of who is away, reschedules it.
 */
export function withStandInEffects(
  state: RoomState,
  result: HandleResult,
  rules: TurnGames
): HandleResult {
  if (!result.ok) return result;
  const changed = result.events.findLast((event) =>
    GameSessionsChanged.is(event)
  );
  // A device's prediction changes nothing, so it schedules nothing.
  if (changed === undefined || !GameSessionsChanged.is(changed)) return result;
  const game = changed.payload.games.current;
  return {
    ...result,
    effects: [
      ...(result.effects ?? []),
      ...gameSessionStandInEffects(state, game, rules),
    ],
  };
}

/** The room puts a stand-in on every side whose person has been away long enough. */
export function handleGameSessionStandIn(
  state: RoomState,
  ctx: GameCommandContext,
  wake: { readonly gameId: string },
  rules: TurnGames
): HandleResult {
  if (ctx.identity !== ROOM_SCHEDULER_IDENTITY)
    return refuseGameSession('only the game may bring in a stand-in');
  const games = GameSessionsAttr.from(state);
  const game = games.current;
  if (game === null || game.id !== wake.gameId)
    return changedGameSessions(games, ctx, rules);
  const due = awayDeadlines(state, game, rules)
    .filter((deadline) => deadline.at <= ctx.ts)
    .map((deadline) => deadline.side);
  if (due.length === 0) return changedGameSessions(games, ctx, rules);
  const next: GameSession = {
    ...game,
    standIns: game.sides.filter(
      (side) => due.includes(side) || game.standIns.includes(side)
    ),
  };
  return changedGameSessions({ ...games, current: next }, ctx, rules);
}
