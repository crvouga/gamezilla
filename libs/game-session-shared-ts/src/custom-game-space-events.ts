import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import { SpaceEnded } from '@libs/spaces-shared-ts/space-log-messages';
import {
  SpaceAwayChanged,
  SpaceMembersRoomAttr,
  SpaceSeatLeft,
  spaceSeatMemberIds,
} from '@libs/spaces-shared-ts/space-members-messages';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  CustomGameAbsenceAttr,
  changeCustomGameAbsence,
} from './custom-game-absence';
import { CustomGameAvailableAttr } from './custom-game-availability';
import { CustomGameAbsencePaused } from './custom-game-commands';
import { replaceCustomGameSide } from './custom-game-configuration';
import {
  customGameWinOrDraw,
  expireCustomGame,
  finishCustomGame,
} from './custom-game-play';
import { changedCustomGames } from './custom-game-result';
import { customGameStandInEffects } from './custom-game-stand-in';
import type { CustomGame } from './custom-game-state';
import {
  CustomGamesAttr,
  customGamePersonSide,
  customGameTerminal,
  OPEN_CUSTOM_GAME_SIDE,
  otherCustomGameSide,
} from './custom-game-state';

function departingCustomGame(
  game: CustomGame,
  person: string,
  now: number,
  rules: TurnGames
): CustomGame {
  if (customGameTerminal(game)) return game;
  if (
    game.status === 'active' &&
    game.sides.length > 2 &&
    customGamePersonSide(game, person) !== null
  )
    return finishCustomGame(game, 'draw', now, 'participant withdrew');
  if (game.creator === person) return finishCustomGame(game, 'cancelled', now);
  if (game.status === 'configuring')
    return game.sides.reduce(
      (g, side) =>
        g[side].person === person
          ? replaceCustomGameSide(g, side, OPEN_CUSTOM_GAME_SIDE)
          : g,
      game
    );
  const side = customGamePersonSide(game, person);
  return side === null
    ? game
    : finishCustomGame(
        game,
        customGameWinOrDraw(
          game,
          otherCustomGameSide(side),
          'resignation',
          rules
        ),
        now
      );
}

/**
 * Whether nobody seated in the space is here. The room counts nobody as
 * present while the host, who keeps it, is away, so the space waits.
 */
function spaceWaiting(state: RoomState): boolean {
  const seats = spaceSeatMemberIds(state);
  const away = SpaceMembersRoomAttr.away.from(state);
  return seats.length > 0 && seats.every((id) => Object.hasOwn(away, id));
}

/**
 * While the space waits for its host, nobody's time away counts: it stops
 * when the host leaves and resumes when they are back, as across an outage
 * of the room itself (which keeps its own pause until the room returns).
 */
function hostAbsenceChange(state: RoomState, now: number) {
  const pausedAt = CustomGameAbsenceAttr.from(state).pausedAt;
  const waiting = spaceWaiting(state);
  if (waiting && pausedAt === null)
    return changeCustomGameAbsence(state, false, now);
  if (!waiting && pausedAt !== null && CustomGameAvailableAttr.from(state))
    return changeCustomGameAbsence(state, true, now);
  return null;
}

export function reactCustomGameToSpaceEvent(
  state: RoomState,
  ctx: GameCommandContext,
  event: Message,
  rules: TurnGames
): HandleResult | null {
  if (SpaceAwayChanged.is(event)) {
    const absence = hostAbsenceChange(state, ctx.ts);
    const next =
      absence === null
        ? state
        : { ...state, ...CustomGameAbsenceAttr(absence) };
    return {
      ok: true,
      events: absence === null ? [] : [CustomGameAbsencePaused({ absence })],
      effects: customGameStandInEffects(
        next,
        CustomGamesAttr.from(state).current
      ),
    };
  }
  if (!SpaceEnded.is(event) && !SpaceSeatLeft.is(event)) return null;
  const games = CustomGamesAttr.from(state);
  const game = games.current;
  if (game === null || customGameTerminal(game)) return null;
  let next = expireCustomGame(game, ctx.ts, rules);
  if (customGameTerminal(next))
    return changedCustomGames({ ...games, current: next }, ctx, rules);
  if (SpaceEnded.is(event)) next = finishCustomGame(next, 'cancelled', ctx.ts);
  else if (SpaceSeatLeft.is(event))
    next = departingCustomGame(next, event.payload.memberId, ctx.ts, rules);
  else return null;
  return next === game
    ? null
    : changedCustomGames({ ...games, current: next }, ctx, rules);
}
