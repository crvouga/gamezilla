import { simulationRoomFixture } from '@libs/game-session-harness-ts/simulation-room-fixture';
import { connectSimulationRoomFixture } from '@libs/game-session-harness-ts/simulation-room-presentation';
import {
  type SimulationSnapshotPayload,
  SimulationStateChanged,
} from '@libs/game-session-shared-ts/simulation-messages';
import type { LightCyclesSeat } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { lightCyclesQuadShared } from '@libs/light-cycles-shared-ts/light-cycles-game';
import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { RoomHarnessRuntime } from '@pkgs/room-root-harness-ts/api';
import { createRoomHarnessRuntime } from '@pkgs/room-root-harness-ts/create-room-harness';
import type { RoomNetEffect } from '@pkgs/room-root-harness-ts/network';
import {
  type OrderedNetwork,
  orderedNetwork,
} from './light-cycles-ordered-network';
import {
  decodeArena,
  deviceGeneration,
  LIGHT_CYCLES_RIDERS,
  type LightCyclesRiderId,
  ridingQuadPosition,
  seatOf,
} from './light-cycles-quad';
import { type TimerProbe, timerProbe } from './light-cycles-timer-probe';
import { LightCyclesWireTap } from './light-cycles-wire-tap';

export const LIGHT_CYCLES_SPECTATOR = 'erin';
export const LIGHT_CYCLES_LATE_SPECTATOR = 'frank';
/** Signed in to the room but neither a member nor a rider. */
export const LIGHT_CYCLES_INTRUDER = 'mallory';
export type LightCyclesPeerId =
  | LightCyclesRiderId
  | typeof LIGHT_CYCLES_SPECTATOR
  | typeof LIGHT_CYCLES_LATE_SPECTATOR;

export type LightCyclesView = {
  readonly position: string | null;
  readonly paused: boolean;
  readonly stale: boolean;
};

export type LightCyclesPeer = {
  readonly id: LightCyclesPeerId;
  readonly seat: LightCyclesSeat | null;
  readonly connection: ReturnType<typeof connectSimulationRoomFixture>;
  /** The newest snapshot this device's replica accepted. */
  processed: SimulationSnapshotPayload | null;
  view: LightCyclesView | null;
  /** Recently presented positions, newest last. */
  readonly presented: string[];
  dropped: boolean;
};

/** A rider's person away from the room, bounded by the authority ticks seen. */
export type LightCyclesAbsence = {
  readonly seat: LightCyclesSeat;
  readonly leftAtMs: number;
  /** Newest published tick before the person left, and when it was sent. */
  readonly tickBefore: number;
  readonly tickBeforeAtMs: number;
  returnedAtMs: number | null;
};

export type ForgedCommand = {
  readonly kind: string;
  readonly seat: LightCyclesSeat;
  readonly sequence: number;
};

export type LightCyclesWorld = {
  readonly session: Session;
  readonly kit: RoomHarnessRuntime;
  readonly network: OrderedNetwork;
  readonly tap: LightCyclesWireTap;
  readonly probe: TimerProbe;
  readonly peers: Map<LightCyclesPeerId, LightCyclesPeer>;
  readonly absences: LightCyclesAbsence[];
  readonly forged: ForgedCommand[];
  /** Connection ids a person's device stopped using. */
  readonly retired: { readonly identity: string; readonly id: string }[];
  readonly stalls: { readonly fromMs: number; readonly toMs: number }[];
  readonly links: Map<string, RoomNetEffect>;
  /** Frames the harness injects; they are not authority publications. */
  readonly injected: WeakSet<object>;
  readonly errors: string[];
};

/** Forged commands carry sequences no device's replica ever reaches. */
export const FORGED_SEQUENCE_BASE = 1_000_000;

/** The replica's own acceptance rule, observed from the same signals. */
function observeProcessed(
  world: LightCyclesWorld,
  peer: LightCyclesPeer,
  message: Parameters<typeof SimulationStateChanged.is>[0]
): void {
  if (!SimulationStateChanged.is(message)) return;
  const snapshot = message.payload;
  if (snapshot.epoch !== deviceGeneration(world.kit, peer.id)) return;
  const previous = peer.processed;
  if (
    previous?.epoch === snapshot.epoch &&
    (snapshot.revision <= previous.revision || snapshot.tick < previous.tick)
  )
    return;
  if (decodeArena(snapshot.state) === null) return;
  peer.processed = snapshot;
}

function progressOf(state: LightCyclesState): readonly number[] {
  const phase = ['countdown', 'running', 'round-over', 'completed'];
  return [state.round, phase.indexOf(state.phase), state.phaseTick];
}

function rewound(before: readonly number[], after: readonly number[]) {
  for (let index = 0; index < before.length; index++) {
    if (after[index]! > before[index]!) return false;
    if (after[index]! < before[index]!) return true;
  }
  return false;
}

function observeView(
  world: LightCyclesWorld,
  peer: LightCyclesPeer,
  view: LightCyclesView
): void {
  const previous = peer.view?.position ?? null;
  peer.view = view;
  if (view.position === null || view.position === previous) return;
  const state = decodeArena(view.position);
  if (state === null) {
    world.errors.push(`${peer.id} presented an invalid arena`);
    return;
  }
  const before = previous === null ? null : decodeArena(previous);
  if (before !== null && rewound(progressOf(before), progressOf(state)))
    world.errors.push(
      `${peer.id} presentation rewound from ${progressOf(before).join('/')} to ${progressOf(state).join('/')}`
    );
  peer.presented.push(view.position);
  if (peer.presented.length > 32) peer.presented.shift();
}

/** One device: a room client with the production presentation adapter. */
export async function addLightCyclesPeer(
  world: LightCyclesWorld,
  id: LightCyclesPeerId
): Promise<LightCyclesPeer> {
  const { kit, session } = world;
  const client = await kit.addClient({ id });
  await kit.drain();
  const room = client.room()!;
  const peer: LightCyclesPeer = {
    id,
    seat: seatOf(id),
    connection: null as never,
    processed: null,
    view: null,
    presented: [],
    dropped: false,
  };
  session.onDispose(
    room.subscribeSignal((message) => observeProcessed(world, peer, message))
  );
  (peer as { connection: LightCyclesPeer['connection'] }).connection =
    connectSimulationRoomFixture(lightCyclesQuadShared, {
      owner: id,
      room,
      clock: session.ports.clock,
      // Presentation frames run on the device, never on the stalled authority host.
      timers: session.ports.timers,
      createId: session.ports.createId,
      changed: (view) => observeView(world, peer, view),
      failed: (error) => world.errors.push(`${id} failed: ${String(error)}`),
    });
  session.onDispose(peer.connection.dispose);
  world.peers.set(id, peer);
  return peer;
}

/** Real room server, clients, transport, session and authority on virtual time. */
export async function createLightCyclesWorld(
  session: Session
): Promise<LightCyclesWorld> {
  const tap = new LightCyclesWireTap(session.ports.clock.now);
  const injected = new WeakSet<object>();
  const network = orderedNetwork(session, (from, to, payload) => {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      injected.has(payload)
    )
      return;
    tap.record(from, to, payload);
  });
  const probe = timerProbe(session.ports.clock, session.ports.timers);
  const host: Session = {
    ...session,
    network,
    ports: { ...session.ports, timers: probe.timers },
  };
  const kit = await createRoomHarnessRuntime({
    session: host,
    module: simulationRoomFixture(
      {
        game: lightCyclesQuadShared,
        id: session.ports.createId(),
        players: Object.values(LIGHT_CYCLES_RIDERS),
        viewers: [LIGHT_CYCLES_SPECTATOR, LIGHT_CYCLES_LATE_SPECTATOR],
        position: ridingQuadPosition(),
      },
      session.ports.clock,
      session.ports.random
    ),
    topic: 'space:light-cycles-network',
  });
  // The room kit is bound to the host session; the system owns this one.
  session.onDispose(kit.dispose);
  (session as { waitForIdle: () => Promise<void> }).waitForIdle = kit.drain;
  const world: LightCyclesWorld = {
    session,
    kit,
    network,
    tap,
    probe,
    peers: new Map(),
    absences: [],
    forged: [],
    retired: [],
    stalls: [],
    links: new Map(),
    injected,
    errors: [],
  };
  const devices: readonly LightCyclesPeerId[] = [
    ...Object.values(LIGHT_CYCLES_RIDERS),
    LIGHT_CYCLES_SPECTATOR,
  ];
  for (const id of devices) await addLightCyclesPeer(world, id);
  await kit.addClient({ id: LIGHT_CYCLES_INTRUDER });
  await kit.runFor(100);
  return world;
}
