import {
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
import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import { initialHarnessPosition } from './simulation-fixtures';

/** An admitted, active two-person session for mechanics/transport probes, without a UI or database. */
export function simulationRoomFixture(
  options: {
    readonly game: GameRegistration;
    readonly id: string;
    readonly viewers: readonly string[];
    readonly position?: string;
  },
  clock: Clock,
  random: Random
) {
  const base = createSpaceModule(
    assertRoomModuleName(options.game.id),
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
  const game = {
    ...newCustomGame(options.id, 'alice', position),
    black: { kind: 'person' as const, person: 'bob' },
    ready: ['white', 'black'] as ('white' | 'black')[],
    status: 'active' as const,
    startedAt: 0,
    turnStartedAt: 0,
  };
  const seats = Object.fromEntries(
    ['alice', 'bob', ...options.viewers].map((id) => [
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

/** Read the saved court and execution checkpoint from a room snapshot. */
export function simulationRoomCourt(state: RoomState) {
  const game = CustomGamesAttr.from(state).current;
  return game?.execution === undefined
    ? null
    : { position: game.fen, execution: game.execution };
}
