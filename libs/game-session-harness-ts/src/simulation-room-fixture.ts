import type { CustomGameChoice } from '@libs/game-session-shared-ts/custom-game-choice';
import {
  ChangeCustomGame,
  ChangeLocalCustomGame,
} from '@libs/game-session-shared-ts/custom-game-commands';
import { soloCustomGame } from '@libs/game-session-shared-ts/custom-game-local';
import {
  BOT_CUSTOM_GAME_SIDE,
  type CustomGame,
  CustomGamesAttr,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import type { GameRegistration } from '@libs/game-session-shared-ts/game-definition';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { createSpaceModule } from '@libs/spaces-shared-ts/space-module';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import {
  createTurnGames,
  gameSides,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import { initialHarnessPosition } from './simulation-fixtures';

/**
 * An admitted, active session for mechanics/transport probes, without a UI or
 * database. `players` fills the game's seats in order: a person's id, or
 * `null` for a bot. It defaults to Alice and Bob for a two-seat game.
 */
export function simulationRoomFixture(
  options: {
    readonly game: GameRegistration;
    readonly id: string;
    readonly viewers: readonly string[];
    readonly players?: readonly (string | null)[];
    readonly position?: string;
  },
  clock: Clock,
  random: Random
) {
  const base = createSpaceModule(
    // A module name is letters and dashes; a mode id may carry its seat count.
    assertRoomModuleName(
      options.game.id.replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
    ),
    [options.game],
    {
      now: clock.now,
      random,
      authority: true,
    }
  );
  const position =
    options.position ?? initialHarnessPosition(options.game, options.id);
  if (!options.game.registration.rules.recognizes(position))
    throw new Error('The simulation fixture position belongs to another game');
  const game = fixtureGame(options, position);
  const people = game.sides.flatMap((side) =>
    game[side].kind === 'person' ? [game[side].person] : []
  );
  const seats = Object.fromEntries(
    [...people, ...options.viewers].map((id) => [
      id,
      { joinedAt: '2026-10-24' },
    ])
  );
  return {
    ...base,
    // Permission/admission suites own access policy. These probes start after admission.
    connectionView: () => ({ mode: 'full' as const }),
    initialState: () => ({
      ...base.initialState(),
      ...GamesRoomAttr.selected(options.game.id),
      ...SpaceMembersRoomAttr.seats(seats),
      ...CustomGamesAttr({ current: game, history: [] }),
    }),
  };
}

function fixtureGame(
  options: {
    readonly game: GameRegistration;
    readonly id: string;
    readonly players?: readonly (string | null)[];
  },
  position: string
) {
  const sides = gameSides(options.game.registration.rules);
  const players = options.players ?? ['alice', 'bob'];
  if (players.length !== sides.length)
    throw new Error('The simulation fixture needs one player for every seat');
  const creator = players.find((player) => player !== null);
  if (creator === undefined || creator === null)
    throw new Error('The simulation fixture needs at least one person');
  const game: CustomGame = {
    ...newCustomGame(options.id, creator, position, sides),
    ready: [...sides],
    status: 'active',
    startedAt: 0,
    turnStartedAt: 0,
  };
  sides.forEach((side, index) => {
    const player = players[index] ?? null;
    game[side] =
      player === null
        ? BOT_CUSTOM_GAME_SIDE
        : { kind: 'person', person: player };
  });
  return game;
}

/** Read the saved court and execution checkpoint from a room snapshot. */
export function simulationRoomCourt(state: RoomState) {
  const game = CustomGamesAttr.from(state).current;
  return game?.execution === undefined
    ? null
    : { position: game.fen, execution: game.execution };
}

/** The fixture's current game: which one, at what revision, and whether it runs. */
export function simulationRoomGame(state: RoomState) {
  const game = CustomGamesAttr.from(state).current;
  return game === null
    ? null
    : { id: game.id, revision: game.revision, status: game.status };
}

export type SimulationRoomOperation = 'rematch' | 'ready' | 'start';

/**
 * The command a person's screen sends for a choice in the current game: kept
 * on their device for a practice with bots, sent to the room otherwise.
 */
export function simulationRoomChoice(
  game: GameRegistration,
  state: RoomState,
  operation: SimulationRoomOperation,
  at: number
) {
  const current = CustomGamesAttr.from(state).current;
  if (current === null) throw new Error('The simulation room has no game');
  const choice = {
    gameId: current.id,
    revision: current.revision,
    operation,
  } as CustomGameChoice;
  return soloCustomGame(current, createTurnGames([game.registration]))
    ? ChangeLocalCustomGame({ choice, at })
    : ChangeCustomGame(choice);
}
