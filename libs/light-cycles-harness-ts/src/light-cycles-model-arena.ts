import {
  simulationRoomCourt,
  simulationRoomFixture,
  simulationRoomGame,
} from '@libs/game-session-harness-ts/simulation-room-fixture';
import {
  RequestSimulationSnapshot,
  type SimulationSnapshotPayload,
  SimulationStateChanged,
} from '@libs/game-session-shared-ts/simulation-messages';
import { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import {
  LIGHT_CYCLES_CONFIG,
  type LightCyclesSeat,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import { defineLightCyclesMode } from '@libs/light-cycles-shared-ts/light-cycles-game';
import {
  type LightCyclesMode,
  lightCyclesPositionCodec,
  lightCyclesStart,
} from '@libs/light-cycles-shared-ts/light-cycles-position';
import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { RoomHarnessRuntime } from '@pkgs/room-root-harness-ts/api';
import { createRoomHarnessRuntime } from '@pkgs/room-root-harness-ts/create-room-harness';
import { orderedNetwork } from './light-cycles-ordered-network';
import { deviceGeneration } from './light-cycles-quad';
import { type TimerProbe, timerProbe } from './light-cycles-timer-probe';
import { LightCyclesWireTap } from './light-cycles-wire-tap';

/**
 * Ticks per movement step in the model's modes. A command takes effect at
 * the authority's next tick, and a step window can hold two waiting turns
 * for each of three riders: nine ticks between steps let every accepted turn
 * show before the step, which the product's three cannot.
 */
export const MODEL_MOVEMENT_TICKS = 10;

/** The model's arena: 4 columns by 3 rows, and the 3rd round is the last. */
function modelMode(id: string, count: 2 | 3): LightCyclesMode {
  return {
    id,
    count,
    width: 4,
    height: 3,
    maxRounds: 3,
    movementTicks: MODEL_MOVEMENT_TICKS,
  };
}

export type ModelGame = 'duel' | 'trio';
export const MODEL_MODES = {
  duel: modelMode('light-cycles-model', 2),
  trio: modelMode('light-cycles-model-3', 3),
} as const satisfies Record<ModelGame, LightCyclesMode>;
const MODEL_GAMES = {
  duel: defineLightCyclesMode(MODEL_MODES.duel),
  trio: defineLightCyclesMode(MODEL_MODES.trio),
} as const;

/** Each rider's seat and the person who rides it. */
export const MODEL_RIDERS = {
  comet: { seat: 'white', person: 'alice' },
  ember: { seat: 'black', person: 'bob' },
  nova: { seat: 'red', person: 'carol' },
} as const satisfies Record<
  string,
  { readonly seat: LightCyclesSeat; readonly person: string }
>;
export type ModelRider = keyof typeof MODEL_RIDERS;
export const MODEL_PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;
export type ModelPerson = (typeof MODEL_PEOPLE)[number];
/** Dave watches; the arena is read from what his device receives. */
export const MODEL_WATCHER: ModelPerson = 'dave';

export type ModelPeer = {
  readonly person: ModelPerson;
  readonly replica: SimulationReplica;
  latest: SimulationSnapshotPayload | null;
};

export type ModelArena = {
  readonly session: Session;
  readonly kit: RoomHarnessRuntime;
  readonly game: ModelGame;
  readonly mode: LightCyclesMode;
  readonly tap: LightCyclesWireTap;
  readonly host: TimerProbe;
  readonly peers: ReadonlyMap<ModelPerson, ModelPeer>;
  /** The authority's arena as the watcher last received it. */
  arena: LightCyclesState;
  /** Ticks the authority committed since the game was set up, by this binding's count. */
  ticks: number;
  forged: number;
  readonly problems: string[];
};

const TICK_MS = 1000 / LIGHT_CYCLES_CONFIG.tickRate;

function decode(arena: ModelArena, position: string): LightCyclesState {
  const state = lightCyclesPositionCodec(arena.mode).decode(position);
  if (state === null) throw new Error('the watcher received no model arena');
  return state;
}

function addPeer(
  arena: Omit<ModelArena, 'arena'>,
  person: ModelPerson
): ModelPeer {
  const { kit, session } = arena;
  const replica = new SimulationReplica({
    simulation: MODEL_GAMES[arena.game].registration.simulation!,
    clock: session.ports.clock,
    send: (message) =>
      kit.clients.get(person)?.room()?.sendSignal(message) ?? null,
    measure: () => {},
  });
  const peer: ModelPeer = { person, replica, latest: null };
  const room = kit.clients.get(person)!.room()!;
  const unsubscribe = room.subscribeSignal((message) => {
    const epoch = deviceGeneration(kit, person);
    if (!SimulationStateChanged.is(message) || epoch === null) return;
    if (replica.receive(message, epoch)) peer.latest = message.payload;
  });
  session.onDispose(() => {
    unsubscribe();
    replica.reset();
  });
  return peer;
}

/** The watcher's newest arena: its last snapshot, or the finished game's record. */
export async function refreshModelArena(arena: ModelArena): Promise<void> {
  const room = arena.kit.clients.get(MODEL_WATCHER)!.room()!;
  if (simulationRoomGame(room.getSnapshot())?.status !== 'completed') {
    room.sendSignal(RequestSimulationSnapshot({ version: 1 }));
    await arena.kit.drain();
  }
  const finished =
    simulationRoomGame(room.getSnapshot())?.status === 'completed';
  if (finished) {
    // A finished game stops its tick loop; its arena is the game's record.
    arena.arena = decode(
      arena,
      simulationRoomCourt(room.getSnapshot())!.position
    );
    return;
  }
  const latest = arena.peers.get(MODEL_WATCHER)!.latest;
  if (latest === null) throw new Error('the watcher has no snapshot');
  if (latest.tick !== arena.ticks)
    arena.problems.push(
      `the authority is at tick ${latest.tick}, but the binding let ${arena.ticks} pass`
    );
  arena.arena = decode(arena, latest.state);
}

/** One authority tick: virtual time runs to the tick loop's next wake. */
export async function tickModelArena(arena: ModelArena): Promise<void> {
  const due = arena.host.nextDueOf(TICK_MS);
  if (due === null) throw new Error('the arena has no running tick loop');
  await arena.kit.scheduler.runFor(
    Math.max(0, due - arena.session.ports.clock.now())
  );
  arena.ticks += 1;
  await arena.kit.drain();
}

/**
 * The real room server, clients, transport and session authority on virtual
 * time: Alice, Bob and Carol on their own devices, Dave watching, in a game
 * already under way at its first countdown.
 */
export async function createModelArena(
  session: Session,
  args: { readonly game: ModelGame; readonly target: number }
): Promise<ModelArena> {
  const tap = new LightCyclesWireTap(session.ports.clock.now);
  const network = orderedNetwork(session, (from, to, payload) =>
    tap.record(from, to, payload)
  );
  const host = timerProbe(session.ports.clock, session.ports.timers);
  const mode = MODEL_MODES[args.game];
  const riders = args.game === 'trio' ? 3 : 2;
  const people = MODEL_PEOPLE.slice(0, riders);
  const kit = await createRoomHarnessRuntime({
    session: {
      ...session,
      network,
      ports: { ...session.ports, timers: host.timers },
    },
    module: simulationRoomFixture(
      {
        game: MODEL_GAMES[args.game],
        id: session.ports.createId(),
        players: people,
        viewers: MODEL_PEOPLE.slice(riders),
        position: lightCyclesPositionCodec(mode).encode(
          lightCyclesStart(mode, args.target)
        ),
      },
      session.ports.clock,
      session.ports.random
    ),
    topic: `space:${mode.id}`,
  });
  session.onDispose(kit.dispose);
  (session as { waitForIdle: () => Promise<void> }).waitForIdle = kit.drain;
  const peers = new Map<ModelPerson, ModelPeer>();
  const base = {
    session,
    kit,
    game: args.game,
    mode,
    tap,
    host,
    peers,
    ticks: 0,
    forged: 0,
    problems: [],
  };
  for (const person of MODEL_PEOPLE) {
    await kit.addClient({ id: person });
    await kit.drain();
    peers.set(person, addPeer(base, person));
  }
  const arena: ModelArena = {
    ...base,
    arena: lightCyclesStart(mode, args.target),
  };
  // Every device asks for the current arena as its screen opens.
  for (const person of MODEL_PEOPLE)
    kit.clients
      .get(person)!
      .room()!
      .sendSignal(RequestSimulationSnapshot({ version: 1 }));
  await kit.drain();
  const latest = peers.get(MODEL_WATCHER)!.latest;
  if (latest === null) throw new Error('the watcher has no snapshot');
  // Setting up may have let the countdown run a few ticks; nothing else.
  arena.ticks = latest.tick;
  await refreshModelArena(arena);
  return arena;
}
