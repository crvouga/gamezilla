import {
  MATCH_GAME_KEY,
  matchRoomGame,
  matchRoomTopic,
} from '@libs/game-matchmaking-shared-ts/match-room';
import { CUSTOM_GAME_GRANT_KEYS } from '@libs/game-session-shared-ts/custom-game-permissions';
import {
  CustomGamesAttr,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import type { GameRegistration } from '@libs/game-session-shared-ts/game-definition';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { gameModules } from '@libs/spaces-shared-ts/game-modules';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { createSpaceModule } from '@libs/spaces-shared-ts/space-module';
import { createSpaceRoomAuthorizer } from '@libs/spaces-shared-ts/space-room-authorize';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Message } from '@pkgs/message-shared-ts/message';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared-ts/client-storage';
import { LoopbackRoomTransport } from '@pkgs/room-adapter-memory-shared-ts/loopback-transport';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared-ts/room-storage';
import { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import { RoomServer } from '@pkgs/room-root-server-ts/room-server';
import type { ClientRoomStorage } from '@pkgs/room-root-shared-ts/core-storage';
import { createTimerScheduleStack } from '@pkgs/room-root-shared-ts/timer-schedule-stack';
import {
  assertRoomModuleName,
  type RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { continuousRaceGame } from './reference-continuous-game';

export async function liveSessionRoom(
  local: boolean | 'players' = false,
  definition: GameRegistration = continuousRaceGame,
  matched = false,
  restored?: { readonly storage: InMemoryRoomStorage; readonly at: number }
) {
  const time = createHarnessClock();
  time.clock.advance(restored?.at ?? 0);
  const custom = createSpaceModule(
    assertRoomModuleName('race-live'),
    [definition],
    { now: time.clock.now, random: () => 0, authority: true }
  );
  const base = matched
    ? gameModules([definition]).flatMap((game) => game.matchRooms ?? [])[0]!
    : custom;
  const topic = matched ? matchRoomTopic('race-1') : 'space:race';
  const sides = gameSides(definition.registration.rules);
  const extra = (side: 'red' | 'blue', person: string) =>
    sides.includes(side) ? { [side]: { kind: 'person' as const, person } } : {};
  const game = {
    ...newCustomGame(
      'race-1',
      'alice',
      definition.registration.rules.initial(),
      sides
    ),
    ...extra('red', 'carol'),
    ...extra('blue', 'dave'),
    black:
      local === 'players'
        ? { kind: 'local' as const, person: '' }
        : local
          ? { kind: 'bot' as const, person: '' }
          : { kind: 'person' as const, person: 'bob' },
    ready: [...sides],
    status: 'active' as const,
    startedAt: 0,
    turnStartedAt: 0,
  };
  const module = {
    ...base,
    initialState: (): RoomState => ({
      ...base.initialState(),
      ...(matched
        ? {
            [MATCH_GAME_KEY]: {
              id: game.id,
              white_id: 'alice',
              black_id: 'bob',
              ...(sides.includes('red') ? { red_id: 'carol' } : {}),
              ...(sides.includes('blue') ? { blue_id: 'dave' } : {}),
              fen: game.fen,
              pgn: '',
              revision: 0,
              turn: definition.turnGame === undefined ? '' : 'alice',
              outcome: 'ongoing',
              reason: null,
              paused_at_ms: null,
            },
          }
        : {}),
      ...GamesRoomAttr.selected(definition.id),
      ...SpaceMembersRoomAttr.seats({
        alice: { joinedAt: '2026-10-23' },
        bob: { joinedAt: '2026-10-23' },
        carol: { joinedAt: '2026-10-23' },
        dave: { joinedAt: '2026-10-23' },
        eve: { joinedAt: '2026-10-23' },
      }),
      ...CustomGamesAttr({ current: game, history: [] }),
    }),
  };
  const storage = restored?.storage ?? new InMemoryRoomStorage();
  const errors: unknown[] = [];
  let next = 0;
  const schedules = createTimerScheduleStack({
    ...time,
    topic,
    createId: () => `wake-${++next}`,
  });
  const server = new RoomServer({
    topic,
    module,
    storage,
    ...time,
    authorize: createSpaceRoomAuthorizer([definition]),
    effectHandlers: [schedules.handler],
    onError: (error) => errors.push(error),
  });
  schedules.bindInject((command) => server.injectCommand(command));
  await server.hydrateFromStorage();
  const clients = new Map<
    string,
    RoomClient<RoomState, Message, Message, string>
  >();
  const transports = new Map<string, LoopbackRoomTransport>();
  const connect = async (
    identity: string,
    clientStorage: ClientRoomStorage = new InMemoryClientStorage(),
    /** Another device of the same person connects under its own name. */
    device: string = identity
  ) => {
    const grants = [
      PERMISSION.spacesLeave,
      ...CUSTOM_GAME_GRANT_KEYS,
      ...(identity === 'alice' ? [PERMISSION.spacesSelectGame] : []),
      ...(matched
        ? [
            PERMISSION.gameMultiplayerWatch,
            ...(identity === 'eve' ? [] : [PERMISSION.gameMultiplayerPlay]),
          ]
        : []),
    ];
    const transport = new LoopbackRoomTransport({
      server,
      connectionId: device,
      identity,
      clientId: device,
      grants,
    });
    const localSchedules = createTimerScheduleStack({
      ...time,
      topic,
      createId: () => `local-wake-${++next}`,
    });
    const room = await RoomClient.open({
      topic,
      module,
      identity,
      storage: clientStorage,
      transport,
      ...time,
      createId: () => `client-${++next}`,
      onError: (error) => errors.push(error),
      effectHandlers: [localSchedules.handler],
      onDestroy: localSchedules.dispose,
    });
    localSchedules.bindInject(({ payload }) => {
      room.dispatch(payload);
    });
    await room.untilSynced();
    clients.set(device, room);
    transports.set(device, transport);
    await settle();
    return room;
  };
  const settle = async () => {
    for (const transport of transports.values()) await transport.flush();
    await server.readCommittedState();
    await server.readCommittedState();
    await server.readCommittedState();
  };
  const advance = async (ticks: number) => {
    for (let index = 0; index < ticks; index++) {
      time.clock.advance(1000 / 60);
      await settle();
    }
  };
  return {
    ...time,
    server,
    storage,
    module,
    errors,
    clients,
    transports,
    connect,
    settle,
    advance,
    current: () => CustomGamesAttr.from(server.getCommittedState()).current!,
    match: () => matchRoomGame(server.getCommittedState())!,
    dispose: () => {
      for (const room of clients.values()) room.destroy();
      server.dispose();
      schedules.dispose();
    },
  };
}
