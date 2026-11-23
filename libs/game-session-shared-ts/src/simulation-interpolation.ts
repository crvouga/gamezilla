import type { SimulationInterpolation } from '@pkgs/turn-game-shared-ts/simulation';
import { simulationInteger } from '@pkgs/turn-game-shared-ts/simulation';

export type InterpolationFrame<S> = {
  readonly tick: number;
  readonly state: S;
};

/**
 * Renderer-independent, bounded presentation history. Sample at the authority's
 * estimated tick minus a jitter buffer. No extrapolation changes scores or
 * physics when a packet is late; presentation holds the last received state.
 */
export class SnapshotInterpolation<S> {
  private frames: InterpolationFrame<S>[] = [];

  constructor(
    private readonly interpolate: SimulationInterpolation<S>,
    private readonly capacity: number
  ) {
    if (!simulationInteger(capacity, 2))
      throw new Error('interpolation capacity must be at least two');
  }

  push(frame: InterpolationFrame<S>): boolean {
    if (!simulationInteger(frame.tick, 0))
      throw new Error('invalid interpolation tick');
    const latest = this.frames.at(-1);
    if (latest !== undefined && frame.tick <= latest.tick) return false;
    this.frames.push(frame);
    if (this.frames.length > this.capacity) this.frames.shift();
    return true;
  }

  sample(tick: number): S | null {
    if (!Number.isFinite(tick)) throw new Error('invalid presentation tick');
    const first = this.frames[0];
    if (first === undefined) return null;
    if (tick <= first.tick) return first.state;
    for (let index = 1; index < this.frames.length; index++) {
      const before = this.frames[index - 1]!;
      const after = this.frames[index]!;
      if (tick <= after.tick)
        return this.interpolate(
          before.state,
          after.state,
          (tick - before.tick) / (after.tick - before.tick)
        );
    }
    return this.frames.at(-1)!.state;
  }

  reset(): void {
    this.frames = [];
  }
}

/** Arrivals remembered to judge the authority's clock and how unevenly its courts arrive. */
const WINDOW = 32;
/** The most delayed arrivals left out as outliers when judging jitter (~6%). */
const JITTER_OUTLIERS = 2;
/** A display frame's worth of slack: courts are sampled at the display's own moments. */
const FRAME_SLACK_MS = 8;
/** The most the playback clock speeds up or slows down to converge, as a share. */
const MAX_DRIFT = 0.1;
/** A gap without courts this long means the authority's clock is judged afresh. */
const STALE_MS = 1000;
/** Ticks over which a playback error is worked off by drifting. */
const CONVERGE_TICKS = 20;

/**
 * The playback clock for interpolated presentation: which authority tick
 * the display shows now. It advances with the device's own clock every
 * frame and converges gently on a target a little behind the authority —
 * one publication interval plus the observed arrival jitter — so a late or
 * early court never freezes or jumps the picture. It jumps only when it has
 * fallen further behind than two publications (`snaps()` counts those);
 * running ahead slows it down instead, so the picture never stops or goes
 * back. After a long silence it judges the authority's clock afresh.
 *
 * The authority's clock is seen through the least delayed of the recent
 * arrivals; nothing is allocated per frame or per arrival.
 */
export function createPlaybackClock(timing: {
  readonly tickRate: number;
  readonly snapshotRate: number;
}) {
  const intervalMs = 1000 / timing.tickRate;
  const publicationMs = 1000 / timing.snapshotRate;
  const snapAfterTicks = Math.max(
    6,
    Math.ceil((2 * timing.tickRate) / timing.snapshotRate)
  );
  const offsets = new Float64Array(WINDOW);
  const scratch = new Float64Array(WINDOW);
  const clock = {
    count: 0,
    next: 0,
    baseMs: 0,
    jitterMs: 0,
    latestTick: -1,
    arrivedAt: Number.NaN,
    tick: Number.NEGATIVE_INFINITY,
    sampledAt: Number.NaN,
    snapped: 0,
  };
  const bufferMs = () => publicationMs + clock.jitterMs + FRAME_SLACK_MS;
  const authorityTick = (nowMs: number) => (nowMs - clock.baseMs) / intervalMs;
  const advance = (nowMs: number, target: number) => {
    const elapsed = Math.max(0, Math.min(100, nowMs - clock.sampledAt));
    const error = target - clock.tick;
    if (error > snapAfterTicks) {
      clock.tick = target;
      clock.snapped++;
      return;
    }
    const drift = Math.max(
      -MAX_DRIFT,
      Math.min(MAX_DRIFT, error / CONVERGE_TICKS)
    );
    clock.tick += (elapsed / intervalMs) * (1 + drift);
  };
  return {
    /** A court for `tick` arrived at `atMs`. */
    arrive(tick: number, atMs: number): void {
      if (atMs - clock.arrivedAt > STALE_MS) {
        clock.count = 0;
        clock.next = 0;
      }
      clock.arrivedAt = atMs;
      offsets[clock.next] = atMs - tick * intervalMs;
      clock.next = (clock.next + 1) % WINDOW;
      clock.count = Math.min(WINDOW, clock.count + 1);
      clock.latestTick = Math.max(clock.latestTick, tick);
      const window = scratch.subarray(0, clock.count);
      window.set(offsets.subarray(0, clock.count));
      window.sort();
      clock.baseMs = window[0]!;
      clock.jitterMs =
        window[Math.max(0, clock.count - 1 - JITTER_OUTLIERS)]! - clock.baseMs;
    },
    /** Whether any court has arrived since the clock began or was reset. */
    started: (): boolean => clock.count > 0,
    /** The authority tick the device estimates is current at `nowMs`. */
    authorityTick,
    /** The tick to show at `nowMs`: monotonic, and never beyond the latest court. */
    sample(nowMs: number): number {
      if (clock.count === 0) return clock.tick;
      const target = authorityTick(nowMs) - bufferMs() / intervalMs;
      if (Number.isFinite(clock.tick)) advance(nowMs, target);
      else clock.tick = target;
      clock.sampledAt = nowMs;
      clock.tick = Math.min(clock.tick, clock.latestTick);
      return clock.tick;
    },
    /** Milliseconds between the authority now and the tick last shown. */
    delayMs: (nowMs: number): number =>
      Number.isFinite(clock.tick)
        ? Math.max(0, (authorityTick(nowMs) - clock.tick) * intervalMs)
        : 0,
    /** Times the clock jumped instead of converging. */
    snaps: (): number => clock.snapped,
    reset(): void {
      clock.count = 0;
      clock.next = 0;
      clock.latestTick = -1;
      clock.arrivedAt = Number.NaN;
      clock.tick = Number.NEGATIVE_INFINITY;
      clock.sampledAt = Number.NaN;
    },
  };
}

export type PlaybackClock = ReturnType<typeof createPlaybackClock>;
