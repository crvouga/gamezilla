import type { LightCyclesSeat } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  type ForgeryKind,
  forgeLightCyclesCommand,
} from './light-cycles-network-forgery';
import {
  addLightCyclesPeer,
  LIGHT_CYCLES_LATE_SPECTATOR,
  type LightCyclesPeerId,
  type LightCyclesWorld,
} from './light-cycles-network-world';
import { decodeArena, LIGHT_CYCLES_RIDERS, seatOf } from './light-cycles-quad';
import { type SteerStyle, steeringFor } from './light-cycles-steering-policy';

/** A rider's own person steers through their device's real replica. */
export const steerRider = defineAction({
  name: 'steerRider',
  act: async (
    world: LightCyclesWorld,
    seat: LightCyclesSeat,
    style: SteerStyle
  ) => {
    const peer = world.peers.get(LIGHT_CYCLES_RIDERS[seat])!;
    const state =
      peer.processed === null ? null : decodeArena(peer.processed.state);
    if (state !== null)
      for (const heading of steeringFor(state, seat, style))
        peer.connection.replica.control(seat, { round: state.round, heading });
    await world.kit.runFor(100);
  },
});

/** Commands that must never move a rider, or move it a second time. */
export const forgeCommand = defineAction({
  name: 'forgeCommand',
  act: async (world: LightCyclesWorld, kind: ForgeryKind) => {
    forgeLightCyclesCommand(world, kind);
    await world.kit.runFor(100);
  },
});

export const advanceArena = defineAction({
  name: 'advanceArena',
  act: async (world: LightCyclesWorld, ms: number) => {
    if (!Number.isSafeInteger(ms) || ms < 1 || ms > 5000)
      throw new Error('advance the arena by 1 to 5000 ms');
    await world.kit.runFor(ms);
  },
});

/** The device loses its connection; its room client stays mounted offline. */
export const dropConnection = defineAction({
  name: 'dropConnection',
  act: async (world: LightCyclesWorld, id: LightCyclesPeerId) => {
    const peer = world.peers.get(id);
    if (peer === undefined || peer.dropped) return;
    const latest = world.tap.latest();
    const leftFrom = world.session.ports.clock.now();
    await world.kit.node(id).disconnect();
    peer.dropped = true;
    const seat = seatOf(id);
    if (seat !== null)
      world.absences.push({
        seat,
        leftAtMs: leftFrom,
        tickBefore: latest?.tick ?? 0,
        tickBeforeAtMs: latest?.atMs ?? leftFrom,
        returnedAtMs: null,
      });
    await world.kit.runFor(50);
  },
});

export async function restorePeer(
  world: LightCyclesWorld,
  id: LightCyclesPeerId
): Promise<void> {
  const peer = world.peers.get(id);
  if (peer === undefined || !peer.dropped) return;
  const absence = world.absences.findLast(
    (item) => item.seat === peer.seat && item.returnedAtMs === null
  );
  if (absence !== undefined)
    absence.returnedAtMs = world.session.ports.clock.now();
  await world.kit.node(id).reconnect();
  peer.dropped = false;
}

export const restoreConnection = defineAction({
  name: 'restoreConnection',
  act: async (world: LightCyclesWorld, id: LightCyclesPeerId) => {
    await restorePeer(world, id);
    await world.kit.runFor(50);
  },
});

/** The same person and device open a new connection that replaces the old one. */
export const replaceConnection = defineAction({
  name: 'replaceConnection',
  act: async (world: LightCyclesWorld, id: LightCyclesPeerId) => {
    const peer = world.peers.get(id);
    if (peer === undefined || peer.dropped) return;
    const before = world.kit.server.connectionIdsForActor(id, id);
    await world.kit.node(id).takeOver();
    for (const connection of before)
      world.retired.push({ identity: id, id: connection });
    await world.kit.runFor(50);
  },
});

/** Ordered latency with jitter on both directions of one device's connection. */
export const impairLink = defineAction({
  name: 'impairLink',
  act: async (
    world: LightCyclesWorld,
    id: LightCyclesPeerId,
    latencyMs: number,
    jitterMs: number
  ) => {
    if (!world.peers.has(id)) return;
    world.links.get(id)?.restore();
    world.links.set(
      id,
      world.kit.net(id).set({
        latencyMeanMs: latencyMs,
        latencyJitterMs: jitterMs,
        dropProbability: 0,
      })
    );
    await world.kit.runFor(50);
  },
});

/** Snapshots wait on the connection, then arrive late as one ordered burst. */
export const holdSnapshots = defineAction({
  name: 'holdSnapshots',
  act: async (world: LightCyclesWorld, id: LightCyclesPeerId, ms: number) => {
    if (!world.peers.has(id)) return;
    const held = world.kit.net(id).set({ toClient: 'hold' });
    try {
      await world.kit.runFor(ms);
    } finally {
      held.restore();
    }
    await world.kit.drain();
  },
});

/** The authority host's event loop blocks; its tick timer wakes late. */
export const stallAuthority = defineAction({
  name: 'stallAuthority',
  act: async (world: LightCyclesWorld, ms: number) => {
    const now = world.session.ports.clock.now();
    world.stalls.push({ fromMs: now, toMs: now + ms });
    world.probe.stall(ms);
    await world.kit.runFor(ms + 50);
  },
});

/** A spectator who opens the arena only after the faults began. */
export const joinLateSpectator = defineAction({
  name: 'joinLateSpectator',
  act: async (world: LightCyclesWorld) => {
    if (world.peers.has(LIGHT_CYCLES_LATE_SPECTATOR)) return;
    await addLightCyclesPeer(world, LIGHT_CYCLES_LATE_SPECTATOR);
    await world.kit.runFor(100);
  },
});

/** Every connection recovers and every device processes current snapshots. */
export const settleArena = defineAction({
  name: 'settleArena',
  act: async (world: LightCyclesWorld) => {
    for (const effect of world.links.values()) effect.restore();
    world.links.clear();
    await world.kit.drain();
    for (const id of world.peers.keys()) await restorePeer(world, id);
    await world.kit.runFor(1200);
  },
});
