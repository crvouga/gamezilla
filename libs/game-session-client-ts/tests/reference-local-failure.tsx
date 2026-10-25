import {
  type CustomGame,
  CustomGamesAttr,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import {
  SpaceOpenRoomsStoreProvider,
  useSpaceOpenRoomsRegistry,
} from '@libs/spaces-client-ts/space-open-rooms-store';
import { SpaceRoomProvider } from '@libs/spaces-client-ts/space-room-context';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { createSpaceModule } from '@libs/spaces-shared-ts/space-module';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { LoggerProvider } from '@pkgs/logger-client-ts/solid';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared-ts/client-storage';
import { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import { TurnGamesProvider } from '@pkgs/turn-game-client-ts/turn-games-context';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { IdProvider } from '@pkgs/uuid-client-ts/solid';
import { type JSX, onCleanup } from 'solid-js';
import { raceGame } from './reference-race-game';

export async function localFailure() {
  const time = createHarnessClock();
  const failure = new Error('saved race temporarily unreadable');
  const storage = new InMemoryClientStorage();
  storage.loadLiveCheckpoint = () => Promise.reject(failure);
  const definition = raceGame;
  const game = {
    ...newCustomGame(
      'race-1',
      'alice',
      definition.registration.rules.initial()
    ),
    black: { kind: 'local' as const, person: '' },
    ready: ['white', 'black'] as ('white' | 'black')[],
    status: 'active' as const,
    startedAt: 0,
    turnStartedAt: 0,
  };
  const module = localModule(game, time.clock.now);
  const transport = offlineTransport();
  let ids = 0;
  const createId = () => `race-input-${++ids}`;
  const room = await RoomClient.open({
    topic: 'space:race',
    module,
    storage,
    transport,
    identity: 'alice',
    ...time,
    createId,
    onError: () => {},
  });
  return {
    ...time,
    room,
    storage,
    game,
    failure,
    createId,
    rules: createTurnGames([definition.registration]),
  };
}

function localModule(game: CustomGame, now: () => number) {
  const base = createSpaceModule(assertRoomModuleName('space'), [raceGame], {
    now,
    random: () => 0,
    authority: false,
  });
  return {
    ...base,
    initialState: () => ({
      ...base.initialState(),
      ...GamesRoomAttr.selected(raceGame.id),
      ...SpaceMembersRoomAttr.seats({ alice: { joinedAt: '2026-10-24' } }),
      ...CustomGamesAttr({ current: game, history: [] }),
    }),
  };
}

/** The device has its saved race offline; this port opens no network session. */
function offlineTransport(): ClientTransport {
  return {
    isConnected: false,
    connect: () => {},
    sendJson: () => {},
    subscribe: () => () => {},
    onHandlers: () => () => {},
    destroy: () => {},
  };
}

type LocalFailure = Awaited<ReturnType<typeof localFailure>>;

function RegisteredRoom(props: {
  readonly rig: LocalFailure;
  readonly children: JSX.Element;
}) {
  const register = useSpaceOpenRoomsRegistry();
  register('race', { room: props.rig.room, clientId: 'alice-tab' });
  onCleanup(() => register('race', null));
  return <SpaceRoomProvider spaceId="race">{props.children}</SpaceRoomProvider>;
}

export function LocalFailureProviders(props: {
  readonly rig: LocalFailure;
  readonly logger: Logger;
  readonly children: JSX.Element;
}) {
  return (
    <ClockProvider clock={props.rig.clock} timers={props.rig.timers}>
      <IdProvider createId={props.rig.createId} random={() => 0}>
        <LoggerProvider value={props.logger}>
          <TurnGamesProvider rules={props.rig.rules} presentations={[]}>
            <SpaceOpenRoomsStoreProvider>
              <RegisteredRoom rig={props.rig}>{props.children}</RegisteredRoom>
            </SpaceOpenRoomsStoreProvider>
          </TurnGamesProvider>
        </LoggerProvider>
      </IdProvider>
    </ClockProvider>
  );
}
