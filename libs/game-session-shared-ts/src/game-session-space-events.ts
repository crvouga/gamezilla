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
  changeGameSessionAbsence,
  GameSessionAbsenceAttr,
} from './game-session-absence';
import { GameSessionAvailableAttr } from './game-session-availability';
import { GameSessionAbsencePaused } from './game-session-commands';
import { replaceGameSessionSide } from './game-session-configuration';
import {
  expireGameSession,
  finishGameSession,
  gameSessionWinOrDraw,
} from './game-session-play';
import { changedGameSessions } from './game-session-result';
import { gameSessionStandInEffects } from './game-session-stand-in';
import type { GameSession } from './game-session-state';
import {
  GameSessionsAttr,
  gameSessionPersonSide,
  gameSessionTerminal,
  OPEN_GAME_SESSION_SIDE,
  otherGameSessionSide,
} from './game-session-state';

function departingGameSession(
  game: GameSession,
  person: string,
  now: number,
  rules: TurnGames
): GameSession {
  if (gameSessionTerminal(game)) return game;
  if (
    game.status === 'active' &&
    game.sides.length > 2 &&
    gameSessionPersonSide(game, person) !== null
  )
    return finishGameSession(game, 'draw', now, 'participant withdrew');
  if (game.creator === person) return finishGameSession(game, 'cancelled', now);
  if (game.status === 'configuring')
    return game.sides.reduce(
      (g, side) =>
        g[side].person === person
          ? replaceGameSessionSide(g, side, OPEN_GAME_SESSION_SIDE)
          : g,
      game
    );
  const side = gameSessionPersonSide(game, person);
  return side === null
    ? game
    : finishGameSession(
        game,
        gameSessionWinOrDraw(
          game,
          otherGameSessionSide(side),
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
  const pausedAt = GameSessionAbsenceAttr.from(state).pausedAt;
  const waiting = spaceWaiting(state);
  if (waiting && pausedAt === null)
    return changeGameSessionAbsence(state, false, now);
  if (!waiting && pausedAt !== null && GameSessionAvailableAttr.from(state))
    return changeGameSessionAbsence(state, true, now);
  return null;
}

export function reactGameSessionToSpaceEvent(
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
        : { ...state, ...GameSessionAbsenceAttr(absence) };
    return {
      ok: true,
      events: absence === null ? [] : [GameSessionAbsencePaused({ absence })],
      effects: gameSessionStandInEffects(
        next,
        GameSessionsAttr.from(state).current,
        rules
      ),
    };
  }
  if (!SpaceEnded.is(event) && !SpaceSeatLeft.is(event)) return null;
  const games = GameSessionsAttr.from(state);
  const game = games.current;
  if (game === null || gameSessionTerminal(game)) return null;
  let next = expireGameSession(game, ctx.ts, rules);
  if (gameSessionTerminal(next))
    return changedGameSessions({ ...games, current: next }, ctx, rules);
  if (SpaceEnded.is(event)) next = finishGameSession(next, 'cancelled', ctx.ts);
  else if (SpaceSeatLeft.is(event))
    next = departingGameSession(next, event.payload.memberId, ctx.ts, rules);
  else return null;
  return next === game
    ? null
    : changedGameSessions({ ...games, current: next }, ctx, rules);
}
