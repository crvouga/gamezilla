import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { SimulationAuthority } from '@libs/game-session-shared-ts/simulation-authority';
import {
  RequestSimulationSnapshot,
  type SimulationSnapshotPayload,
  SimulationStateChanged,
} from '@libs/game-session-shared-ts/simulation-messages';
import { createSpaceModule } from '@libs/spaces-shared-ts/space-module';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Message } from '@pkgs/message-shared-ts/message';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared-ts/client-storage';
import { LoopbackRoomTransport } from '@pkgs/room-adapter-memory-shared-ts/loopback-transport';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared-ts/room-storage';
import { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import { RoomServer } from '@pkgs/room-root-server-ts/room-server';
import { createTimerScheduleStack } from '@pkgs/room-root-shared-ts/timer-schedule-stack';
import {
  assertRoomModuleName,
  type RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { z } from 'zod';
import { bots, rules } from './reference-game';
import { type RaceState, raceSimulation } from './reference-simulation';

const stateSchema = z
  .object({
    distance: z.number(),
    luck: z.number(),
    inputs: z.array(z.string()),
  })
  .strict();
export const parseRaceInput = (value: unknown) =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 99
    ? value
    : null;

export async function simulationRoom(simulation = raceSimulation()) {
  const time = createHarnessClock();
  const definition = defineGame({
    rules,
    capabilities: { 'custom-games': { bots } },
    turnAutomation: { choose: () => null, perform: async () => {} },
  });
  const composed = createSpaceModule(
    assertRoomModuleName('counting-race'),
    [definition],
    { now: time.clock.now, random: () => 0, authority: true }
  );
  // Admission policy is covered by room's connection/grant suites; every admitted
  // person reads here, while the execution adapter decides who controls a seat.
  const module = {
    ...composed,
    connectionView: () => ({ mode: 'full' as const }),
  };
  const storage = new InMemoryRoomStorage();
  const errors: unknown[] = [];
  const processingMs: number[] = [];
  let nextId = 0;
  const schedules = createTimerScheduleStack({
    ...time,
    topic: 'race:1',
    createId: () => `schedule-${++nextId}`,
  });
  let authority: SimulationAuthority<RaceState, number>;
  const server = new RoomServer({
    topic: 'race:1',
    module: {
      ...module,
      createRuntime: () => ({
        receive: (command, identity: string) =>
          authority.receive(command, identity),
      }),
    },
    storage,
    clock: time.clock,
    effectHandlers: [schedules.handler],
  });
  schedules.bindInject((command) => server.injectCommand(command));
  await server.hydrateFromStorage();
  authority = new SimulationAuthority(
    simulation,
    {
      epoch: 'race-round-1',
      controllers: new Map([
        ['first', 'alice'],
        ['second', 'bob'],
      ]),
      codec: {
        encode: JSON.stringify,
        decode: (encoded) => {
          try {
            return stateSchema.parse(JSON.parse(encoded));
          } catch {
            return null;
          }
        },
      },
      parseInput: parseRaceInput,
    },
    {
      ...time,
      snapshotRate: 20,
      publish: (message, audience) => server.publishSignal(message, audience),
      measure: () => {},
      inputProcessed: (samples: readonly number[]) =>
        processingMs.push(...samples),
      onError: (error) => errors.push(error),
    }
  );
  const clients = new Map<
    string,
    RoomClient<RoomState, Message, Message, string>
  >();
  const transports = new Map<string, LoopbackRoomTransport>();
  const connect = async (identity: string) => {
    const transport = new LoopbackRoomTransport({
      server,
      identity,
      connectionId: identity,
      clientId: identity,
    });
    const room = await RoomClient.open({
      topic: 'race:1',
      module,
      identity,
      storage: new InMemoryClientStorage(),
      transport,
      ...time,
      createId: () => `input-${++nextId}`,
      onError: (error) => errors.push(error),
    });
    await room.untilSynced();
    clients.set(identity, room);
    transports.set(identity, transport);
    return room;
  };
  return {
    ...time,
    simulation,
    authority,
    server,
    storage,
    clients,
    transports,
    errors,
    processingMs,
    connect,
    dispose: () => {
      for (const client of clients.values()) client.destroy();
      authority.dispose();
      schedules.dispose();
    },
  };
}

export function requestState(
  room: RoomClient<RoomState, Message, Message, string>
): Promise<SimulationSnapshotPayload> {
  return new Promise((resolve, reject) => {
    let unsubscribeState = () => {};
    let requestId: string | null = null;
    const unsubscribe = room.subscribeSignal((message) => {
      if (!SimulationStateChanged.is(message)) return;
      unsubscribe();
      unsubscribeState();
      resolve(message.payload);
    });
    unsubscribeState = room.subscribeCommandResult((result) => {
      if (result.ok || result.commandId !== requestId) return;
      unsubscribe();
      unsubscribeState();
      reject(
        new Error(
          'reason' in result.error
            ? result.error.reason
            : 'snapshot request failed'
        )
      );
    });
    requestId = room.sendSignal(RequestSimulationSnapshot({ version: 1 }));
    if (requestId === null) {
      unsubscribe();
      unsubscribeState();
      reject(new Error('room is not synchronized'));
    }
  });
}
