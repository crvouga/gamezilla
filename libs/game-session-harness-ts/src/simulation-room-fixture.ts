import {
  CustomGamesAttr,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import type { GameRegistration } from '@libs/game-session-shared-ts/game-definition';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { createSpaceModule } from '@libs/spaces-shared-ts/space-module';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import { initialHarnessPosition } from './simulation-fixtures';

/** An admitted, active two-person session for mechanics/transport probes, without a UI or database. */
export function simulationRoomFixture(
  options: {
    readonly game: GameRegistration;
    readonly id: string;
    readonly viewers: readonly string[];
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
  const game = {
    ...newCustomGame(
      options.id,
      'alice',
      initialHarnessPosition(options.game, options.id)
    ),
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
