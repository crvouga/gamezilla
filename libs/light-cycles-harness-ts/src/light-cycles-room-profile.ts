import { simulationRoomFixture } from '@libs/game-session-harness-ts/simulation-room-fixture';
import {
  RequestSimulationSnapshot,
  SimulationStateChanged,
} from '@libs/game-session-shared-ts/simulation-messages';
import { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import type { LightCyclesSeat } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { lightCyclesQuadShared } from '@libs/light-cycles-shared-ts/light-cycles-game';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { RoomHarnessRuntime } from '@pkgs/room-root-harness-ts/api';
import { ROOM_VIRTUAL_RUNTIME } from '@pkgs/room-root-harness-ts/boot';
import { createRoomHarnessRuntime } from '@pkgs/room-root-harness-ts/create-room-harness';
import { orderedNetwork } from './light-cycles-ordered-network';
import { refusedCommandBatch, summarize } from './light-cycles-profile-sample';
import {
  decodeArena,
  deviceGeneration,
  LIGHT_CYCLES_QUAD_SIMULATION,
  LIGHT_CYCLES_RIDERS,
  ridingQuadPosition,
  seatOf,
} from './light-cycles-quad';
import { steeringFor } from './light-cycles-steering-policy';
import { type TimerProbe, timerProbe } from './light-cycles-timer-probe';
import { LightCyclesWireTap } from './light-cycles-wire-tap';

/**
 * The fixed virtual workload: four riders on their own devices plus
 * `spectators` watchers; every link 40 ms ± 10 ms each way, in order; each
 * alive rider turns toward open road every 500 ms; one rider away for 1 s
 * from a third of the window; one 200 ms stall of the authority host at
 * half; one batch of five refused commands at two thirds. The target score
 * is 9, so no window ends the game.
 */
export const LIGHT_CYCLES_PROFILE_WORKLOAD = Object.freeze({
  latencyMs: 40,
  jitterMs: 10,
  steerEveryMs: 500,
  awayMs: 1000,
  stallMs: 200,
  targetScore: 9,
  frameMs: 100,
});
const W = LIGHT_CYCLES_PROFILE_WORKLOAD;
const AWAY = LIGHT_CYCLES_RIDERS.blue;

export type ProfilePeer = {
  readonly id: string;
  readonly seat: LightCyclesSeat | null;
  readonly replica: SimulationReplica;
  /** Virtual ms from publication to this device accepting it. */
  readonly ages: number[];
};

export type LightCyclesProfile = {
  readonly session: Session;
  readonly kit: RoomHarnessRuntime;
  readonly tap: LightCyclesWireTap;
  readonly host: TimerProbe;
  readonly peers: ReadonlyMap<string, ProfilePeer>;
  readonly spectators: number;
  sample: ReturnType<typeof summarize> | null;
};

/** A device's replica on the production snapshot path, without a renderer. */
function addPeer(profile: LightCyclesProfile, id: string): ProfilePeer {
  const { kit, session, tap } = profile;
  const replica = new SimulationReplica({
    simulation: LIGHT_CYCLES_QUAD_SIMULATION,
    clock: session.ports.clock,
    send: (message) => kit.clients.get(id)?.room()?.sendSignal(message) ?? null,
    measure: () => {},
  });
  const peer: ProfilePeer = { id, seat: seatOf(id), replica, ages: [] };
  const room = kit.clients.get(id)!.room()!;
  const unsubscribe = room.subscribeSignal((message) => {
    const epoch = deviceGeneration(kit, id);
    if (!SimulationStateChanged.is(message) || epoch === null) return;
    if (!replica.receive(message, epoch)) return;
    const emission = tap.emissions.findLast(
      (item) => item.revision === message.payload.revision
    );
    if (emission !== undefined)
      peer.ages.push(session.ports.clock.now() - emission.atMs);
  });
  session.onDispose(() => {
    unsubscribe();
    replica.reset();
  });
  room.sendSignal(RequestSimulationSnapshot({ version: 1 }));
  return peer;
}

async function createProfile(
  session: Session,
  args: { readonly spectators: number }
): Promise<LightCyclesProfile> {
  const { spectators } = args;
  if (!Number.isSafeInteger(spectators) || spectators < 0 || spectators > 100)
    throw new Error('Profile spectators must be an integer from 0 to 100');
  const tap = new LightCyclesWireTap(session.ports.clock.now);
  const network = orderedNetwork(session, (from, to, payload) =>
    tap.record(from, to, payload)
  );
  const host = timerProbe(session.ports.clock, session.ports.timers);
  const viewers = Array.from({ length: spectators }, (_, i) => `viewer-${i}`);
  const kit = await createRoomHarnessRuntime({
    session: {
      ...session,
      network,
      ports: { ...session.ports, timers: host.timers },
    },
    module: simulationRoomFixture(
      {
        game: lightCyclesQuadShared,
        id: '0f3b3c63-5c8e-4c1e-9a52-6a1f1cbd9e2f',
        players: Object.values(LIGHT_CYCLES_RIDERS),
        viewers,
        position: ridingQuadPosition(W.targetScore),
      },
      session.ports.clock,
      session.ports.random
    ),
    topic: 'space:light-cycles-profile',
  });
  session.onDispose(kit.dispose);
  (session as { waitForIdle: () => Promise<void> }).waitForIdle = kit.drain;
  const peers = new Map<string, ProfilePeer>();
  const profile = { session, kit, tap, host, peers, spectators, sample: null };
  for (const id of [...Object.values(LIGHT_CYCLES_RIDERS), ...viewers]) {
    await kit.addClient({ id });
    kit.net(id).set({
      latencyMeanMs: W.latencyMs,
      latencyJitterMs: W.jitterMs,
      dropProbability: 0,
    });
    await kit.drain();
    peers.set(id, addPeer(profile, id));
  }
  return profile;
}

function steer(profile: LightCyclesProfile): void {
  for (const peer of profile.peers.values()) {
    const latest = peer.seat === null ? null : profile.tap.latest();
    const state = latest === null ? null : decodeArena(latest.state);
    if (state === null || peer.seat === null) continue;
    for (const heading of steeringFor(state, peer.seat, 'valid'))
      peer.replica.control(peer.seat, { round: state.round, heading });
  }
}

/** The away rider's device comes back and asks for a current arena, as a screen does. */
async function rejoin(profile: LightCyclesProfile): Promise<void> {
  await profile.kit.node(AWAY).reconnect();
  profile.peers.get(AWAY)!.replica.reset();
  profile.kit.clients
    .get(AWAY)
    ?.room()
    ?.sendSignal(RequestSimulationSnapshot({ version: 1 }));
}

async function runWorkload(
  profile: LightCyclesProfile,
  ms: number,
  events: boolean
): Promise<void> {
  const frames = Math.ceil(ms / W.frameMs);
  const away = Math.round(frames / 3);
  for (let frame = 0; frame < frames; frame++) {
    if (frame % (W.steerEveryMs / W.frameMs) === 0) steer(profile);
    if (events && frame === away) await profile.kit.node(AWAY).disconnect();
    if (events && frame === away + W.awayMs / W.frameMs) await rejoin(profile);
    if (events && frame === Math.round(frames / 2))
      profile.host.stall(W.stallMs);
    if (events && frame === Math.round((2 * frames) / 3))
      refusedCommandBatch(profile);
    await profile.kit.runFor(W.frameMs);
  }
}

/** Riding starts and every device holds a current arena before measuring. */
export const primeLightCyclesProfile = defineAction({
  name: 'primeLightCyclesProfile',
  act: async (profile: LightCyclesProfile) => {
    await runWorkload(profile, 1000, false);
  },
});

export const sampleLightCyclesRoom = defineAction({
  name: 'sampleLightCyclesRoom',
  act: async (profile: LightCyclesProfile, ms: number) => {
    if (!Number.isSafeInteger(ms) || ms < 3000 || ms > 30_000)
      throw new Error(
        'Profile window must be an integer from 3000 to 30000 ms'
      );
    const { tap, kit, session } = profile;
    const start = {
      at: session.ports.clock.now(),
      tick: tap.latest()?.tick ?? 0,
      events: (await kit.storage.loadEventsAfter(kit.topic, 0)).length,
      rejections: tap.rejections.length,
      welcomes: new Map(tap.welcomes),
      connections: new Map(
        [...tap.connectionIds].map(([id, ids]) => [id, ids.size])
      ),
    };
    tap.resetTraffic();
    profile.host.resetLateness();
    for (const peer of profile.peers.values()) peer.ages.length = 0;
    await runWorkload(profile, ms, true);
    profile.sample = summarize(profile, start, {
      events: (await kit.storage.loadEventsAfter(kit.topic, 0)).length,
      checkpoint: await kit.storage.loadLiveCheckpoint(kit.topic),
    });
  },
});

export const lightCyclesRoomProfile = defineSystem({
  name: 'light-cycles-room-profile',
  args: { spectators: 2 },
  runtimes: [ROOM_VIRTUAL_RUNTIME],
  create: createProfile,
  actions: [primeLightCyclesProfile, sampleLightCyclesRoom],
});

export const readLightCyclesRoomProfile = (profile: LightCyclesProfile) =>
  profile.sample;
