/**
 * The space's puzzle session as a space installs it — `PUZZLE_SESSIONS`
 * bound to every conformance game at once — with the commands a device
 * sends and the events the room commits, for the per-game session suites.
 * A puzzle finds its game by its position, so each game's suite also proves
 * the session never confuses it with another.
 */

import { StartPuzzlePlay } from '@libs/game-puzzle-shared/play-messages';
import { PUZZLE_SESSIONS } from '@libs/game-puzzle-shared/puzzle-sessions';
import type { PuzzleGame } from '@libs/game-puzzle-shared/puzzle-setup';
import { rulesTrail } from '@libs/game-session-harness/game-puzzle-laws';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import type { PuzzleFixture } from '@libs/game-session-harness/known-puzzles';
import type { GameCommandContext } from '@libs/spaces-shared/game';
import { mergeGameRouterEntries } from '@libs/spaces-shared/game';
import { isMessageEnvelope } from '@pkgs/message-shared/message';
import { createComposedMessageRouter } from '@pkgs/message-shared/router';
import type {
  HandleResult,
  RoomCommandPayload,
  RoomState,
} from '@pkgs/room-root-shared/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';
import { CONFORMANCE_GAMES } from '../../conformance-world';

const session = PUZZLE_SESSIONS.bind(
  createTurnGames(CONFORMANCE_GAMES.map((game) => game.shared.turnGame))
);

const commands = createComposedMessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
>(mergeGameRouterEntries(session.commandRouters));

const events = createComposedMessageRouter<RoomState, void, RoomState>(
  mergeGameRouterEntries(session.eventRouters)
);

export const HOST = 'host-1';
export const GUEST = 'guest-1';

/** A space's puzzle session before anyone starts a puzzle. */
export function idleSession(): RoomState {
  return session.initialState?.() ?? {};
}

let commandIds = 0;

/** The room's answer to `payload` from `identity` at `ts`; nothing is applied. */
export function send(
  state: RoomState,
  payload: RoomCommandPayload,
  identity = HOST,
  ts = 1
): HandleResult {
  commandIds += 1;
  return sendAs(state, payload, { identity, ts, id: `cmd-${commandIds}` });
}

/** The room's answer to `payload` under the command id `id`. */
export function sendAs(
  state: RoomState,
  payload: RoomCommandPayload,
  command: {
    readonly identity: string;
    readonly ts: number;
    readonly id: string;
  }
): HandleResult {
  if (!isMessageEnvelope(payload))
    return {
      ok: false,
      error: { type: ROOM_ERROR_TYPE.invalidCommand, reason: 'no envelope' },
    };
  return commands.dispatch(
    state,
    {
      identity: command.identity,
      ts: command.ts,
      commandId: command.id,
      random: () => 0,
    },
    payload,
    (_state, _ctx, message) => ({
      ok: false,
      error: {
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: String(message.type),
      },
    })
  );
}

/** The state after the room's events for `result`, which must be accepted. */
export function committed(state: RoomState, result: HandleResult): RoomState {
  if (!result.ok)
    throw new Error(`the room refused: ${JSON.stringify(result.error)}`);
  return result.events.reduce<RoomState>(
    (next, event) =>
      isMessageEnvelope(event)
        ? events.dispatch(next, undefined, event, (same) => same)
        : next,
    state
  );
}

/** `payload` from `identity`, committed. */
export function apply(
  state: RoomState,
  payload: RoomCommandPayload,
  identity = HOST,
  ts = 1
): RoomState {
  return committed(state, send(state, payload, identity, ts));
}

/** The room's start command for `fixture`'s puzzle. */
export function startCommand(fixture: PuzzleFixture): RoomCommandPayload {
  return StartPuzzlePlay({
    puzzleId: fixture.record.id,
    fen: fixture.record.position,
    moves: fixture.record.line.join(' '),
  });
}

/** `fixture`'s puzzle started by `identity` in an idle session. */
export function started(fixture: PuzzleFixture, identity = HOST): RoomState {
  return apply(idleSession(), startCommand(fixture), identity);
}

/** `game`'s known puzzles, its rules and puzzles capability, and its positions. */
export function puzzleCase(game: HarnessGame) {
  const known = game.fixtures.puzzles;
  const puzzles = game.shared.turnGame.capabilities.puzzles;
  if (known === undefined || puzzles === undefined)
    throw new Error(`${game.label} offers no puzzles`);
  const rules = game.shared.turnGame.rules;
  const puzzleGame: PuzzleGame = { rules, puzzles };
  // Retrying, stepping and a first result that stays need two solver moves.
  const long = known.find((fixture) => fixture.solution.length >= 2);
  if (long === undefined)
    throw new Error(
      `${game.label}: name a known puzzle of two solver moves or more`
    );
  return {
    known,
    long,
    rules,
    puzzles,
    puzzleGame,
    /** The positions of `fixture`'s line, by the game's rules alone. */
    trail: (fixture: PuzzleFixture) => rulesTrail(rules, fixture.record),
    /** How the game's rules name `action` at `position`. */
    labelOf: (position: string, action: string) =>
      rules.play(position, action, '', [])?.label ?? null,
  };
}
