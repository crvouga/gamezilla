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
  CustomGameAbsenceAttr,
  customGameAwaySince,
} from './custom-game-absence';
import { CustomGamesChanged, StandInCustomGame } from './custom-game-commands';
import { CUSTOM_GAME_AWAY_CLAIM_MS } from './custom-game-refusal';
import { changedCustomGames, refuseCustomGame } from './custom-game-result';
import type { CustomGame, CustomGameSide } from './custom-game-state';
import { CustomGamesAttr } from './custom-game-state';

/**
 * Stand-ins: in a custom game of more than two sides, a participant away for
 * the away grace period no longer holds everyone up. A disclosed stand-in
 * bot plays their side, with their side's private setup and nothing more,
 * until they take it back (`reclaim`). Their side, readiness and result
 * stay theirs; only who decides for the side changes. A two-sided game keeps
 * its own policy: the other participant may claim the win instead.
 */

const STAND_IN_SCHEDULE = 'chess-custom:stand-in';
/** How long a participant stays away before a stand-in plays their side. */
export const CUSTOM_GAME_STAND_IN_MS = CUSTOM_GAME_AWAY_CLAIM_MS;

/** Whether a person here plays `side` themselves. */
function playedByPersonHere(
  state: RoomState,
  game: CustomGame,
  side: CustomGameSide
): boolean {
  return (
    game[side].kind === 'person' &&
    !game.standIns.includes(side) &&
    customGameAwaySince(state, game[side].person) === null
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
  game: CustomGame
): readonly { readonly side: CustomGameSide; readonly at: number }[] {
  if (game.status !== 'active' || game.sides.length <= 2) return [];
  if (CustomGameAbsenceAttr.from(state).pausedAt !== null) return [];
  return game.sides.flatMap((side) => {
    if (game[side].kind !== 'person' || game.standIns.includes(side)) return [];
    const since = customGameAwaySince(state, game[side].person);
    if (since === null) return [];
    const heldUp = game.sides.some(
      (other) => other !== side && playedByPersonHere(state, game, other)
    );
    return heldUp ? [{ side, at: since + CUSTOM_GAME_STAND_IN_MS }] : [];
  });
}

/** The room's next stand-in wake for `game`, or none. */
export function customGameStandInEffects(
  state: RoomState,
  game: CustomGame | null
): readonly RoomEffect[] {
  const deadlines = game === null ? [] : awayDeadlines(state, game);
  if (game === null || deadlines.length === 0)
    return [CancelScheduleEffect({ id: STAND_IN_SCHEDULE })];
  return [
    ScheduleEffect({
      id: STAND_IN_SCHEDULE,
      at: Math.min(...deadlines.map((deadline) => deadline.at)),
      payload: StandInCustomGame({ gameId: game.id }),
    }),
  ];
}

/**
 * `result` with the stand-in wake its custom game now needs: every change of
 * the game, and every change of who is away, reschedules it.
 */
export function withStandInEffects(
  state: RoomState,
  result: HandleResult
): HandleResult {
  if (!result.ok) return result;
  const changed = result.events.findLast((event) =>
    CustomGamesChanged.is(event)
  );
  // A device's prediction changes nothing, so it schedules nothing.
  if (changed === undefined || !CustomGamesChanged.is(changed)) return result;
  const game = changed.payload.games.current;
  return {
    ...result,
    effects: [
      ...(result.effects ?? []),
      ...customGameStandInEffects(state, game),
    ],
  };
}

/** The room puts a stand-in on every side whose person has been away long enough. */
export function handleCustomGameStandIn(
  state: RoomState,
  ctx: GameCommandContext,
  wake: { readonly gameId: string },
  rules: TurnGames
): HandleResult {
  if (ctx.identity !== ROOM_SCHEDULER_IDENTITY)
    return refuseCustomGame('only the game may bring in a stand-in');
  const games = CustomGamesAttr.from(state);
  const game = games.current;
  if (game === null || game.id !== wake.gameId)
    return changedCustomGames(games, ctx, rules);
  const due = awayDeadlines(state, game)
    .filter((deadline) => deadline.at <= ctx.ts)
    .map((deadline) => deadline.side);
  if (due.length === 0) return changedCustomGames(games, ctx, rules);
  const next: CustomGame = {
    ...game,
    standIns: game.sides.filter(
      (side) => due.includes(side) || game.standIns.includes(side)
    ),
  };
  return changedCustomGames({ ...games, current: next }, ctx, rules);
}
