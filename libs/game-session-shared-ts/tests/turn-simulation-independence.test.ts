import { expect, test } from 'bun:test';
import { ChangeCustomGame } from '@libs/game-session-shared-ts/custom-game-commands';
import {
  CustomGamesAttr,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { createSpaceModule } from '@libs/spaces-shared-ts/space-module';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared-ts/room-storage';
import { RoomServer } from '@pkgs/room-root-server-ts/room-server';
import { createTimerScheduleStack } from '@pkgs/room-root-shared-ts/timer-schedule-stack';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import { continuousRaceGame } from './reference-continuous-game';
import { bots, rules } from './reference-game';

test('installing a simulation beside a turn game does not require simulation timers to play its turns', async () => {
  // regression: mixed-registry-requires-simulation-timers
  const turn = defineGame({
    rules: { ...rules, id: 'turn-race' },
    capabilities: { 'custom-games': { bots } },
    turnAutomation: { choose: () => 'advance-token', perform: async () => {} },
  });
  const time = createHarnessClock();
  const schedules = createTimerScheduleStack({
    ...time,
    topic: 'space:turn-only',
    createId: () => 'turn-wake',
  });
  const module = createSpaceModule(
    assertRoomModuleName('mixed-games'),
    [turn, continuousRaceGame],
    { now: () => 0, random: () => 0, authority: true }
  );
  const current = {
    ...newCustomGame('turn-only-session', 'alice', rules.initial()),
    black: { kind: 'person' as const, person: 'bob' },
    status: 'active' as const,
    ready: ['white', 'black'] as ('white' | 'black')[],
    startedAt: 0,
    turnStartedAt: 0,
  };
  const server = new RoomServer({
    topic: 'space:turn-only',
    storage: new InMemoryRoomStorage(),
    clock: time.clock,
    effectHandlers: [schedules.handler],
    module: {
      ...module,
      initialState: () => ({
        ...module.initialState(),
        ...GamesRoomAttr.selected(turn.id),
        ...CustomGamesAttr({ current, history: [] }),
        ...SpaceMembersRoomAttr.seats({
          alice: { joinedAt: '2026-10-23' },
          bob: { joinedAt: '2026-10-23' },
        }),
      }),
    },
  });
  schedules.bindInject((command) => server.injectCommand(command));
  try {
    await server.hydrateFromStorage();
    await server.injectCommand({
      id: 'first-turn',
      identity: 'alice',
      payload: ChangeCustomGame({
        gameId: current.id,
        revision: 0,
        operation: 'move',
        uci: 'advance-token',
        ply: 0,
      }),
    });
    const played = CustomGamesAttr.from(
      await server.readCommittedState()
    ).current;
    expect(played?.fen).toBe('race:1');
    expect(played?.moves.map((move) => move.uci)).toEqual(['advance-token']);
    expect(played?.execution).toBeUndefined();
    expect(time.clock.pendingOneShotCount()).toBe(0);
  } finally {
    schedules.dispose();
    server.dispose();
  }
});
