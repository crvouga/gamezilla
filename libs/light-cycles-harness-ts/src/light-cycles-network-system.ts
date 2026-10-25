import { defineProperty } from '@pkgs/harness-root-shared-ts/define-property';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import { ROOM_VIRTUAL_RUNTIME } from '@pkgs/room-root-harness-ts/boot';
import {
  advanceArena,
  dropConnection,
  forgeCommand,
  holdSnapshots,
  impairLink,
  joinLateSpectator,
  replaceConnection,
  restoreConnection,
  settleArena,
  stallAuthority,
  steerRider,
} from './light-cycles-network-actions';
import {
  absentRiders,
  authoritativeArena,
  devicesStayValid,
  sampleOf,
} from './light-cycles-network-properties';
import {
  createLightCyclesWorld,
  type LightCyclesPeer,
  type LightCyclesWorld,
} from './light-cycles-network-world';
import {
  decodeArena,
  LIGHT_CYCLES_QUAD_CODEC,
  LIGHT_CYCLES_TIMING,
} from './light-cycles-quad';

const SNAPSHOT_TICKS =
  LIGHT_CYCLES_TIMING.tickRate / LIGHT_CYCLES_TIMING.snapshotRate;

/** Why a device has not caught up with the authority, or null once it has. */
function lagOf(world: LightCyclesWorld, peer: LightCyclesPeer): string | null {
  const latest = world.tap.latest();
  const sent = world.tap.lastSentTo(peer.id);
  const processed = peer.processed;
  if (peer.dropped || world.kit.clients.get(peer.id)?.isSynced() !== true)
    return 'is not connected';
  if (latest === null || sent === null || processed === null)
    return 'has no snapshot';
  if (sent.tick < latest.tick - 2 * SNAPSHOT_TICKS)
    return `was last sent tick ${sent.tick} while the arena is at ${latest.tick}`;
  if (processed.epoch !== sent.epoch || processed.revision !== sent.revision)
    return `processed revision ${processed.revision}, not the current ${sent.revision}`;
  if (processed.state !== sent.state) return 'decoded another arena';
  const decoded = decodeArena(processed.state);
  if (
    decoded === null ||
    LIGHT_CYCLES_QUAD_CODEC.encode(decoded) !== sent.state
  )
    return 'cannot decode the arena exactly';
  return null;
}

/** The device's picture is an authority arena it received, not paused or stale. */
function presentationLagOf(
  world: LightCyclesWorld,
  peer: LightCyclesPeer
): string | null {
  const view = peer.view;
  if (view === null || view.position === null) return 'presents nothing';
  if (view.stale || view.paused) return 'presents a stale or paused arena';
  const recent = new Set(world.tap.emissions.slice(-16).map((e) => e.state));
  return recent.has(view.position)
    ? null
    : 'presents an arena the authority did not just publish';
}

export function convergenceViolations(world: LightCyclesWorld): string[] {
  return [...world.peers.values()].flatMap((peer) => {
    const lag = lagOf(world, peer) ?? presentationLagOf(world, peer);
    return lag === null ? [] : [`${peer.id} ${lag}`];
  });
}

/**
 * (a) Once connectivity recovers and each device processed a current
 * snapshot, every rider, spectator and the late spectator decode exactly the
 * authority's arena at the tick it last sent them.
 */
export const devicesConverge = defineProperty({
  name: 'devices-converge',
  check: (world: LightCyclesWorld, _model: void, action) => {
    if (!settleArena.is(action)) return;
    const problems = convergenceViolations(world);
    if (problems.length > 0) throw new Error(problems.join('\n'));
  },
});

export const LIGHT_CYCLES_NETWORK_ACTIONS = [
  steerRider,
  forgeCommand,
  advanceArena,
  dropConnection,
  restoreConnection,
  replaceConnection,
  impairLink,
  holdSnapshots,
  stallAuthority,
  joinLateSpectator,
  settleArena,
] as const;

export const lightCyclesNetworkSystem = defineSystem({
  name: 'light-cycles-quad-network',
  runtimes: [ROOM_VIRTUAL_RUNTIME],
  create: createLightCyclesWorld,
  actions: LIGHT_CYCLES_NETWORK_ACTIONS,
  properties: [
    authoritativeArena,
    absentRiders,
    devicesStayValid,
    devicesConverge,
  ],
});

/** A replay fingerprint: every publication and every input, in wire order. */
export function readLightCyclesTimeline(world: LightCyclesWorld) {
  return {
    publications: world.tap.emissions.map(
      (e) => `${e.epoch}#${e.revision}@${e.tick}:${e.atMs}:${e.state}`
    ),
    inputs: world.tap.inputs.map(
      (item) =>
        `${item.client}:${item.input.playerId}:${item.input.sequence}@${item.atMs}`
    ),
    rejections: world.tap.rejections.map(
      (item) => `${item.client}:${item.reason}`
    ),
  };
}

/** What a scenario observed: outcome counts, for coverage and reporting. */
export function readLightCyclesNetwork(world: LightCyclesWorld) {
  const latest = world.tap.latest();
  const state = latest === null ? null : decodeArena(latest.state);
  const retirements = new Set<string>();
  for (const emission of world.tap.emissions)
    for (const crash of sampleOf(emission).state.crashes)
      if (crash.cause === 'retired')
        retirements.add(`${sampleOf(emission).state.round}:${crash.seat}`);
  return {
    publications: world.tap.emissions.length,
    tick: latest?.tick ?? 0,
    round: state?.round ?? 0,
    scores: state?.scores ?? [],
    retirements: retirements.size,
    rejections: world.tap.rejections.length,
    forged: world.forged.length,
    absences: world.absences.length,
    convergence: convergenceViolations(world),
    errors: world.errors,
  };
}
