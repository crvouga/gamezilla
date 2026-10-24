import { simulationRoomFixture } from '@libs/game-session-harness-ts/simulation-room-fixture';
import {
  RequestSimulationSnapshot,
  type SimulationSnapshotPayload,
  SimulationStateChanged,
} from '@libs/game-session-shared-ts/simulation-messages';
import { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import {
  pongGameShared,
  pongPositionCodec,
} from '@libs/pong-shared-ts/pong-game';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { RoomHarnessRuntime } from '@pkgs/room-root-harness-ts/api';
import { ROOM_VIRTUAL_RUNTIME } from '@pkgs/room-root-harness-ts/boot';
import { createRoomHarnessRuntime } from '@pkgs/room-root-harness-ts/create-room-harness';
import { PongRoomTraffic } from './pong-room-traffic';

type Peer = {
  readonly replica: SimulationReplica;
  snapshot: SimulationSnapshotPayload | null;
};
type Profile = {
  readonly session: Session;
  readonly kit: RoomHarnessRuntime;
  readonly traffic: PongRoomTraffic;
  readonly peers: ReadonlyMap<string, Peer>;
  readonly spectators: number;
  sample: Awaited<ReturnType<typeof readRoomSample>> | null;
};
const simulation = pongGameShared.registration.simulation!;

function addPeer(session: Session, kit: RoomHarnessRuntime, id: string): Peer {
  const room = kit.clients.get(id)!.room()!;
  const replica = new SimulationReplica({
    simulation,
    clock: session.ports.clock,
    send: room.sendSignal.bind(room),
    measure: () => {},
  });
  const peer: Peer = { replica, snapshot: null };
  const unsubscribe = room.subscribeSignal((message) => {
    if (!SimulationStateChanged.is(message)) return;
    peer.snapshot = message.payload;
    replica.receive(message, message.payload.epoch);
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
): Promise<Profile> {
  if (
    !Number.isSafeInteger(args.spectators) ||
    args.spectators < 0 ||
    args.spectators > 100
  )
    throw new Error('Profile spectators must be an integer from 0 to 100');
  const viewers = Array.from(
    { length: args.spectators },
    (_, i) => `viewer-${i}`
  );
  const traffic = new PongRoomTraffic();
  const network = {
    ...session.network,
    send: ((from, to, payload, options) => {
      traffic.record(from, payload);
      session.network.send(from, to, payload, options);
    }) satisfies Session['network']['send'],
  };
  const measuredSession = { ...session, network };
  const kit = await createRoomHarnessRuntime({
    session: measuredSession,
    module: simulationRoomFixture(
      {
        game: pongGameShared,
        id: '8a98babc-6347-4b73-93d4-3462182c338f',
        viewers,
      },
      session.ports.clock,
      session.ports.random
    ),
    topic: 'space:profile',
  });
  // The room kit owns its measured session; the system owns the original session.
  session.onDispose(kit.dispose);
  (session as { waitForIdle: () => Promise<void> }).waitForIdle = kit.drain;
  const peers = new Map<string, Peer>();
  for (const id of ['alice', 'bob', ...viewers]) {
    await kit.addClient({ id });
    await kit.drain();
    peers.set(id, addPeer(session, kit, id));
  }
  await kit.drain();
  return {
    session,
    kit,
    traffic,
    peers,
    spectators: args.spectators,
    sample: null,
  };
}

async function advanceProfile(s: Profile, ms: number): Promise<void> {
  const frames = Math.ceil((ms * simulation.timing.tickRate) / 1000);
  for (let frame = 0; frame < frames; frame++) {
    s.peers.get('alice')!.replica.pump();
    s.peers.get('bob')!.replica.pump();
    await s.kit.runFor(1000 / simulation.timing.tickRate);
  }
}

async function readRoomSample(
  s: Profile,
  start: { readonly at: number; readonly tick: number; readonly events: number }
) {
  const snapshot = s.peers.get('alice')!.snapshot!;
  const recovery = await s.kit.storage.loadLiveCheckpoint(s.kit.topic);
  const events = await s.kit.storage.loadEventsAfter(s.kit.topic, 0);
  return {
    spectators: s.spectators,
    peers: s.peers.size,
    virtualMs: s.session.ports.clock.now() - start.at,
    publishedTickDelta: snapshot.tick - start.tick,
    traffic: s.traffic.read(),
    durableEventsAdded: events.length - start.events,
    liveCheckpointBytes: new TextEncoder().encode(JSON.stringify(recovery))
      .byteLength,
    endingState: pongPositionCodec.decode(snapshot.state),
    acknowledgments: snapshot.acknowledged,
  };
}

export const primePongProfile = defineAction({
  name: 'primePongProfile',
  act: async (s: Profile) => {
    if (
      !s.peers
        .get('alice')!
        .replica.control('white', { kind: 'target', target: 0.35 }) ||
      !s.peers
        .get('bob')!
        .replica.control('black', { kind: 'target', target: 0.65 })
    )
      throw new Error('Profile controls are not ready');
    await advanceProfile(s, 4000);
  },
});

export const samplePongRoom = defineAction({
  name: 'samplePongRoom',
  act: async (s: Profile, ms: number) => {
    if (!Number.isSafeInteger(ms) || ms < 1000 || ms > 10_000)
      throw new Error(
        'Profile window must be an integer from 1000 to 10000 ms'
      );
    const events = await s.kit.storage.loadEventsAfter(s.kit.topic, 0);
    const start = {
      at: s.session.ports.clock.now(),
      tick: s.peers.get('alice')!.snapshot!.tick,
      events: events.length,
    };
    s.traffic.reset();
    await advanceProfile(s, ms);
    s.sample = await readRoomSample(s, start);
  },
});

export const pongRoomProfile = defineSystem({
  name: 'pong-room-profile',
  args: { spectators: 0 },
  runtimes: [ROOM_VIRTUAL_RUNTIME],
  create: createProfile,
  actions: [primePongProfile, samplePongRoom],
});
export const readPongRoomProfile = (s: Profile) => s.sample;
