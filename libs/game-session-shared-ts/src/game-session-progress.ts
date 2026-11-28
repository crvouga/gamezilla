import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import {
  GameSessionProgressed,
  type GameSessionProgressedPayload,
  GameSessionsChanged,
} from './game-session-commands';
import type { GameSession, GameSessions } from './game-session-state';
import { GameSessionsAttr } from './game-session-state';

/**
 * Whether `next` only appended moves to `previous`'s current game and left
 * the history alone; the appended moves when so.
 */
function appendedMoves(
  previous: GameSessions,
  next: GameSessions
): GameSession['moves'] | null {
  const before = previous.current;
  const after = next.current;
  if (
    before === null ||
    after === null ||
    before.id !== after.id ||
    previous.history.length !== next.history.length ||
    after.moves.length <= before.moves.length
  )
    return null;
  const base = before.moves.length;
  if (base > 0) {
    const last = before.moves[base - 1]!;
    const kept = after.moves[base - 1]!;
    if (last.uci !== kept.uci || last.san !== kept.san) return null;
  }
  return after.moves.slice(base);
}

/**
 * `events` with each change that only appended moves recorded as just what
 * it appended (`GameSessionProgressed`), against the game sessions `state`
 * held before them. Nothing else is rewritten, and the order is kept.
 */
export function compactGameSessionEvents(
  state: RoomState,
  events: readonly Message[]
): Message[] {
  let games = GameSessionsAttr.from(state);
  return events.map((event) => {
    if (!GameSessionsChanged.is(event)) return event;
    const next = event.payload.games;
    const appended = appendedMoves(games, next);
    const previous = games;
    games = next;
    if (appended === null || next.current === null) return event;
    return GameSessionProgressed({
      game: { ...next.current, moves: [] },
      base: previous.current!.moves.length,
      moves: [...appended],
      commandId: event.payload.commandId,
      reason: event.payload.reason,
    });
  });
}

/** `result` with its changes of the game sessions compacted against `state`. */
export function compactGameSessionResult(
  state: RoomState,
  result: HandleResult
): HandleResult {
  return result.ok
    ? { ...result, events: compactGameSessionEvents(state, result.events) }
    : result;
}

/**
 * The game sessions a progress leaves: the current game as recorded, with its
 * earlier moves and the appended ones. A copy whose current game does not
 * match what the progress was recorded against keeps its games unchanged;
 * every copy folds the same log in order, so none does.
 */
export function progressedGameSessions(
  games: GameSessions,
  progress: GameSessionProgressedPayload
): GameSessions {
  const before = games.current;
  if (
    before === null ||
    before.id !== progress.game.id ||
    before.moves.length !== progress.base
  )
    return games;
  return {
    ...games,
    current: { ...progress.game, moves: [...before.moves, ...progress.moves] },
  };
}
