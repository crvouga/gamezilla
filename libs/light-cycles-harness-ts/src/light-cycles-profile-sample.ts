import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { RoomHarnessRuntime } from '@pkgs/room-root-harness-ts/api';
import {
  decodeArena,
  LIGHT_CYCLES_RIDERS,
  LIGHT_CYCLES_TIMING,
} from './light-cycles-quad';
import type { TimerProbe } from './light-cycles-timer-probe';
import type { LightCyclesWireTap, WireTally } from './light-cycles-wire-tap';

type Source = {
  readonly session: Session;
  readonly kit: RoomHarnessRuntime;
  readonly tap: LightCyclesWireTap;
  readonly host: TimerProbe;
  readonly peers: ReadonlyMap<string, { readonly ages: readonly number[] }>;
  readonly spectators: number;
};

type WindowStart = {
  readonly at: number;
  readonly tick: number;
  readonly events: number;
  readonly rejections: number;
  readonly welcomes: ReadonlyMap<string, number>;
  readonly connections: ReadonlyMap<string, number>;
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Count, mean, 95th percentile and maximum, in the samples' unit. */
export function distribution(values: readonly number[]) {
  if (values.length === 0) return { count: 0, mean: 0, p95: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    mean: round3(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    p95: round3(sorted[Math.ceil(sorted.length * 0.95) - 1]!),
    max: round3(sorted.at(-1)!),
  };
}

const perSecond = (tally: WireTally, seconds: number) => ({
  bytesPerSecond: Math.round(tally.bytes / seconds),
  messagesPerSecond: round3(tally.frames / seconds),
});

/**
 * Five commands the authority must refuse: a spectator's, another seat's,
 * an earlier game's, and a basis from the future and from too long ago.
 */
export function refusedCommandBatch(profile: Source): void {
  const latest = profile.tap.latest();
  const state = latest === null ? null : decodeArena(latest.state);
  if (latest === null || state === null) return;
  const alice = LIGHT_CYCLES_RIDERS.white;
  const send = (from: string, change: Record<string, unknown>) =>
    profile.kit.clients
      .get(from)
      ?.room()
      ?.sendSignal(
        SubmitSimulationInput({
          version: 1,
          epoch: latest.epoch,
          playerId: 'white',
          sequence: 1_000_000 + profile.tap.inputs.length,
          tick: latest.tick,
          value: { round: state.round, heading: 'up' },
          ...change,
        })
      );
  send(profile.spectators > 0 ? 'viewer-0' : LIGHT_CYCLES_RIDERS.black, {});
  send(alice, { playerId: 'black' });
  send(alice, { epoch: 'an-earlier-game:1:0' });
  send(alice, { tick: latest.tick + LIGHT_CYCLES_TIMING.tickRate });
  send(alice, { tick: Math.max(0, latest.tick - 40) });
}

/** Connections opened and full welcomes sent during the window. */
function reconnects(tap: LightCyclesWireTap, start: WindowStart) {
  let opened = 0;
  let welcomes = 0;
  for (const [id, ids] of tap.connectionIds)
    opened += ids.size - (start.connections.get(id) ?? 0);
  for (const [id, count] of tap.welcomes)
    welcomes += count - (start.welcomes.get(id) ?? 0);
  return { opened, welcomes };
}

function rejectionsByReason(tap: LightCyclesWireTap, start: WindowStart) {
  const counts: Record<string, number> = {};
  for (const item of tap.rejections.slice(start.rejections))
    counts[item.reason] = (counts[item.reason] ?? 0) + 1;
  return counts;
}

/** Everything one window measured, per virtual second where it is a rate. */
export function summarize(
  profile: Source,
  start: WindowStart,
  end: { readonly events: number; readonly checkpoint: unknown }
) {
  const { tap, session } = profile;
  const virtualMs = session.ports.clock.now() - start.at;
  const seconds = virtualMs / 1000;
  const latest = tap.latest();
  const state = latest === null ? null : decodeArena(latest.state);
  const traffic = tap.read();
  const lateness = profile.host.lateness();
  const publishedTickDelta = (latest?.tick ?? 0) - start.tick;
  return {
    peers: profile.peers.size,
    spectators: profile.spectators,
    virtualMs,
    ticks: {
      published: publishedTickDelta,
      dueAtTickRate: Math.floor(seconds * LIGHT_CYCLES_TIMING.tickRate),
    },
    schedulingDelayMs: {
      fired: lateness.fired,
      mean: round3(
        lateness.fired === 0 ? 0 : lateness.totalMs / lateness.fired
      ),
      max: round3(lateness.maxMs),
    },
    snapshots: {
      published: traffic.publications.frames,
      meanBytes: Math.round(
        traffic.publications.bytes / Math.max(1, traffic.publications.frames)
      ),
      maxBytes: traffic.publications.maxFrameBytes,
      deliveries: traffic.snapshots.frames,
      ageMs: distribution(
        [...profile.peers.values()].flatMap((peer) => [...peer.ages])
      ),
    },
    connections: Object.fromEntries(
      Object.entries(traffic.connections).map(([id, tally]) => [
        id,
        {
          up: perSecond(tally.up, seconds),
          down: perSecond(tally.down, seconds),
        },
      ])
    ),
    rejections: rejectionsByReason(tap, start),
    reconnects: reconnects(tap, start),
    durableEventsAdded: end.events - start.events,
    liveCheckpointBytes: new TextEncoder().encode(
      JSON.stringify(end.checkpoint)
    ).byteLength,
    round: state?.round ?? 0,
    phase: state?.phase ?? null,
    scores: state?.scores ?? [],
    acknowledged: latest?.acknowledged ?? {},
  };
}
