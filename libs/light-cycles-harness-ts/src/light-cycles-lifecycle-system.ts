import {
  type SimulationRoomOperation,
  simulationRoomChoice,
  simulationRoomFixture,
  simulationRoomGame,
} from '@libs/game-session-harness-ts/simulation-room-fixture';
import { connectSimulationRoomFixture } from '@libs/game-session-harness-ts/simulation-room-presentation';
import {
  lightCyclesDuelShared,
  lightCyclesQuadShared,
} from '@libs/light-cycles-shared-ts/light-cycles-game';
import {
  lightCyclesPositionCodec,
  lightCyclesStart,
} from '@libs/light-cycles-shared-ts/light-cycles-position';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { RoomHarnessRuntime } from '@pkgs/room-root-harness-ts/api';
import { ROOM_VIRTUAL_RUNTIME } from '@pkgs/room-root-harness-ts/boot';
import { createRoomHarnessRuntime } from '@pkgs/room-root-harness-ts/create-room-harness';
import type { RoomHarnessClient } from '@pkgs/room-root-harness-ts/handles';
import { orderedNetwork } from './light-cycles-ordered-network';
import {
  activeTickSubscriptions,
  countingRoom,
  type SubscriptionLedger,
} from './light-cycles-resource-probes';
import { type TimerProbe, timerProbe } from './light-cycles-timer-probe';

/** A Duel practice runs on Alice's device; a Quad with two people runs in the room. */
export type LifecycleMode = 'duel-practice' | 'quad-shared';

const MODES = {
  'duel-practice': { game: lightCyclesDuelShared, players: ['alice', null] },
  'quad-shared': {
    game: lightCyclesQuadShared,
    players: ['alice', 'bob', null, null],
  },
} as const;

export type ResourceSample = {
  readonly roomTimers: number;
  readonly deviceTimers: number;
  readonly tickSubscriptions: number;
  readonly roomSubscriptions: number;
  readonly queuedFrames: number;
  readonly pendingCommands: number;
};

export type LifecycleRecord = {
  readonly mode: LifecycleMode;
  readonly games: string[];
  /** Sampled while each game is running, in order. */
  readonly running: ResourceSample[];
  /** Sampled after each game finished, before its rematch. */
  readonly between: ResourceSample[];
  after: ResourceSample | null;
  readonly errors: string[];
};

type Room = {
  readonly kit: RoomHarnessRuntime;
  readonly people: readonly RoomHarnessClient[];
  readonly room: TimerProbe;
  readonly device: TimerProbe;
  readonly subscriptions: SubscriptionLedger;
  readonly queued: () => number;
  readonly record: LifecycleRecord;
};

export type LifecycleWorld = {
  readonly session: Session;
  readonly records: LifecycleRecord[];
};

function current(client: RoomHarnessClient) {
  const room = client.room();
  return room === null ? null : simulationRoomGame(room.getSnapshot());
}

function sample(room: Room): ResourceSample {
  return {
    roomTimers: room.room.outstanding(),
    deviceTimers: room.device.outstanding(),
    tickSubscriptions: activeTickSubscriptions(),
    roomSubscriptions: room.subscriptions.active,
    queuedFrames: room.queued(),
    pendingCommands: room.people.reduce(
      (total, person) =>
        total + (person.room()?.getPendingQueueIds().length ?? 0),
      0
    ),
  };
}

async function openRoom(
  world: LifecycleWorld,
  mode: LifecycleMode,
  index: number
): Promise<Room> {
  const { session } = world;
  const network = orderedNetwork(session);
  const roomTimers = timerProbe(session.ports.clock, session.ports.timers);
  const { game, players } = MODES[mode];
  const kit = await createRoomHarnessRuntime({
    session: {
      ...session,
      network,
      ports: { ...session.ports, timers: roomTimers.timers },
    },
    module: simulationRoomFixture(
      {
        game,
        id: session.ports.createId(),
        players,
        viewers: [],
        position: lightCyclesPositionCodec(players.length as 2 | 4).encode(
          lightCyclesStart(players.length as 2 | 4, 1)
        ),
      },
      session.ports.clock,
      session.ports.random
    ),
    topic: `space:light-cycles-lifecycle-${index}`,
  });
  session.onDispose(kit.dispose);
  (session as { waitForIdle: () => Promise<void> }).waitForIdle = kit.drain;
  const people: RoomHarnessClient[] = [];
  for (const person of players)
    if (person !== null) people.push(await kit.addClient({ id: person }));
  await kit.drain();
  const record: LifecycleRecord = {
    mode,
    games: [],
    running: [],
    between: [],
    after: null,
    errors: [],
  };
  world.records.push(record);
  return {
    kit,
    people,
    room: roomTimers,
    device: timerProbe(session.ports.clock, session.ports.timers),
    subscriptions: { active: 0 },
    queued: network.queued,
    record,
  };
}

/** Each person's screen mounts one presentation while a game is active, as the client does. */
function mountScreens(world: LifecycleWorld, room: Room) {
  return room.people.map((person) =>
    connectSimulationRoomFixture(MODES[room.record.mode].game, {
      owner: person.id,
      room: countingRoom(person.room()!, room.subscriptions),
      clock: world.session.ports.clock,
      timers: room.device.timers,
      createId: world.session.ports.createId,
      changed: () => {},
      failed: (error) => room.record.errors.push(String(error)),
    })
  );
}

async function playToCompletion(room: Room): Promise<void> {
  const host = room.people[0]!;
  for (let elapsed = 0; elapsed <= 300_000; elapsed += 1000) {
    if (current(host)?.status === 'completed') return;
    await room.kit.runFor(1000);
    if (current(host)?.status === 'active')
      room.record.running.push(sample(room));
  }
  throw new Error(`the ${room.record.mode} game never finished`);
}

async function choose(
  room: Room,
  person: RoomHarnessClient,
  operation: SimulationRoomOperation
): Promise<void> {
  person.dispatch(
    simulationRoomChoice(
      MODES[room.record.mode].game,
      person.room()!.getSnapshot(),
      operation,
      Math.floor(room.kit.clock.now())
    )
  );
  await room.kit.runFor(50);
}

async function rematch(room: Room): Promise<void> {
  const [host] = room.people;
  await choose(room, host!, 'rematch');
  for (const person of room.people) await choose(room, person, 'ready');
  await choose(room, host!, 'start');
  if (current(host!)?.status !== 'active')
    throw new Error(`the ${room.record.mode} rematch did not start`);
}

/** Create a room, play it to the end and rematch `games - 1` times, then dispose it. */
export const playRoomLifecycle = defineAction({
  name: 'playRoomLifecycle',
  act: async (world: LifecycleWorld, mode: LifecycleMode, games: number) => {
    const room = await openRoom(world, mode, world.records.length);
    for (let game = 0; game < games; game++) {
      if (game > 0) await rematch(room);
      room.record.games.push(current(room.people[0]!)!.id);
      const screens = mountScreens(world, room);
      await room.kit.runFor(100);
      await playToCompletion(room);
      for (const screen of screens) screen.dispose();
      await room.kit.runFor(100);
      room.record.between.push(sample(room));
    }
    await room.kit.dispose();
    const scheduler = world.session.scheduler.underlying;
    (world.session as { waitForIdle: () => Promise<void> }).waitForIdle = () =>
      scheduler.runFor(0);
    await scheduler.runFor(1000);
    room.record.after = sample(room);
  },
});

export const lightCyclesLifecycleSystem = defineSystem({
  name: 'light-cycles-room-lifecycle',
  runtimes: [ROOM_VIRTUAL_RUNTIME],
  create: (session: Session): LifecycleWorld => {
    activeTickSubscriptions();
    return { session, records: [] };
  },
  actions: [playRoomLifecycle],
});

export const readLifecycleRecords = (world: LifecycleWorld) => world.records;
