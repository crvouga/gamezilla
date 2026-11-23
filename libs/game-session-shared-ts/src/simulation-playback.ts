/** Arrivals remembered to judge the authority's clock and how unevenly its courts arrive. */
const WINDOW = 32;
/** Arrivals left out as outliers when judging jitter (the latest ~6%). */
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
 * early court never freezes or jumps the picture. It jumps only when it is
 * further off than `snapAfterTicks`, which `snaps()` counts.
 *
 * The authority's clock is seen through the least delayed of the recent
 * arrivals; no allocation happens per frame or per arrival.
 */
export class PlaybackClock {
  private readonly offsets = new Float64Array(WINDOW);
  private readonly scratch = new Float64Array(WINDOW);
  private count = 0;
  private next = 0;
  private baseMs = 0;
  private jitterMs = 0;
  private latestTick = -1;
  private arrivedAt = Number.NaN;
  private tick = Number.NEGATIVE_INFINITY;
  private sampledAt = Number.NaN;
  private snapped = 0;
  private readonly intervalMs: number;
  private readonly publicationMs: number;
  private readonly snapAfterTicks: number;

  constructor(timing: { readonly tickRate: number; readonly snapshotRate: number }) {
    this.intervalMs = 1000 / timing.tickRate;
    this.publicationMs = 1000 / timing.snapshotRate;
    this.snapAfterTicks = Math.max(
      6,
      Math.ceil((2 * timing.tickRate) / timing.snapshotRate)
    );
  }

  /** A court for `tick` arrived at `atMs`. */
  arrive(tick: number, atMs: number): void {
    // After a long silence the old arrivals say nothing about the clock now;
    // what was shown stays, and playback resumes from the new arrivals.
    if (atMs - this.arrivedAt > STALE_MS) {
      this.count = 0;
      this.next = 0;
    }
    this.arrivedAt = atMs;
    this.offsets[this.next] = atMs - tick * this.intervalMs;
    this.next = (this.next + 1) % WINDOW;
    this.count = Math.min(WINDOW, this.count + 1);
    this.latestTick = Math.max(this.latestTick, tick);
    const window = this.scratch.subarray(0, this.count);
    window.set(this.offsets.subarray(0, this.count));
    window.sort();
    this.baseMs = window[0]!;
    const kept = Math.max(0, this.count - 1 - JITTER_OUTLIERS);
    this.jitterMs = window[kept]! - this.baseMs;
  }

  /** Whether any court has arrived since the clock began or was reset. */
  started(): boolean {
    return this.count > 0;
  }

  /** How far behind the authority the display aims to be, in milliseconds. */
  bufferMs(): number {
    return this.publicationMs + this.jitterMs + FRAME_SLACK_MS;
  }

  /** The authority tick the device estimates is current at `nowMs`. */
  authorityTick(nowMs: number): number {
    return (nowMs - this.baseMs) / this.intervalMs;
  }

  /** The tick to show at `nowMs`: monotonic, and never beyond the latest court. */
  sample(nowMs: number): number {
    if (this.count === 0) return this.tick;
    const target = this.authorityTick(nowMs) - this.bufferMs() / this.intervalMs;
    if (!Number.isFinite(this.tick)) this.tick = target;
    else {
      const elapsed = Math.max(0, Math.min(100, nowMs - this.sampledAt));
      const error = target - this.tick;
      // Only falling far behind jumps; running ahead slows down instead, so
      // the picture never stops or goes back.
      if (error > this.snapAfterTicks) {
        this.tick = target;
        this.snapped++;
      } else {
        const drift = Math.max(
          -MAX_DRIFT,
          Math.min(MAX_DRIFT, error / CONVERGE_TICKS)
        );
        this.tick += (elapsed / this.intervalMs) * (1 + drift);
      }
    }
    this.sampledAt = nowMs;
    this.tick = Math.min(this.tick, this.latestTick);
    return this.tick;
  }

  /** Milliseconds between the authority now and the tick last shown. */
  delayMs(nowMs: number): number {
    return Number.isFinite(this.tick)
      ? Math.max(0, (this.authorityTick(nowMs) - this.tick) * this.intervalMs)
      : 0;
  }

  /** Times the clock jumped instead of converging. */
  snaps(): number {
    return this.snapped;
  }

  reset(): void {
    this.count = 0;
    this.next = 0;
    this.latestTick = -1;
    this.arrivedAt = Number.NaN;
    this.tick = Number.NEGATIVE_INFINITY;
    this.sampledAt = Number.NaN;
  }
}
