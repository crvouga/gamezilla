import {
  FALLBACK_POLL_MS,
  LIFECYCLE_SWEEP_JITTER_MS,
  RECONCILE_JITTER_RATIO,
  RECONCILE_MS,
} from './subscription-constants';

export type SharedSchedulerHooks = {
  readonly isRunning: () => boolean;
  readonly isForeground: () => boolean;
  readonly isConnectedMode: () => boolean;
  readonly sweepWithJitter: (maxMs: number, reason: SweepReason) => void;
  readonly millisSinceLastSweep: () => number;
  readonly now: () => number;
  readonly random: () => number;
  readonly fallbackPollMs: number;
  readonly reconcileMs: number;
};

export type SweepReason =
  | 'fallback'
  | 'reconcile'
  | 'lifecycle'
  | 'reconnect'
  | 'nudge'
  | 'manual';

/** Owns the shared FALLBACK + RECONCILE timers (no per-subscription intervals). */
export class SharedPollScheduler {
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly hooks: SharedSchedulerHooks) {}

  start(): void {
    this.armFallback();
    this.armReconcile();
  }

  stop(): void {
    this.clearFallback();
    this.clearReconcile();
  }

  /** Call when connectedMode / foreground changes. */
  refresh(): void {
    this.armFallback();
    this.armReconcile();
  }

  private clearFallback(): void {
    if (this.fallbackTimer === null) return;
    clearTimeout(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  private clearReconcile(): void {
    if (this.reconcileTimer === null) return;
    clearTimeout(this.reconcileTimer);
    this.reconcileTimer = null;
  }

  private armFallback(): void {
    this.clearFallback();
    if (!this.hooks.isRunning()) return;
    if (!this.hooks.isForeground()) return;
    if (this.hooks.isConnectedMode()) return;
    this.fallbackTimer = setTimeout(() => {
      this.fallbackTimer = null;
      if (!this.hooks.isRunning()) return;
      if (!this.hooks.isForeground()) return;
      if (this.hooks.isConnectedMode()) return;
      this.hooks.sweepWithJitter(LIFECYCLE_SWEEP_JITTER_MS, 'fallback');
      this.armFallback();
    }, this.hooks.fallbackPollMs);
  }

  private armReconcile(): void {
    this.clearReconcile();
    if (!this.hooks.isRunning()) return;
    if (!this.hooks.isForeground()) return;
    const base = this.hooks.reconcileMs;
    const jitter = base * RECONCILE_JITTER_RATIO;
    const delay = Math.max(
      1,
      Math.floor(base + (this.hooks.random() * 2 - 1) * jitter)
    );
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      if (!this.hooks.isRunning()) return;
      if (!this.hooks.isForeground()) return;
      if (this.hooks.millisSinceLastSweep() < this.hooks.reconcileMs) {
        this.armReconcile();
        return;
      }
      // Timer already includes ± RECONCILE_JITTER_RATIO — no extra lifecycle jitter.
      this.hooks.sweepWithJitter(0, 'reconcile');
      this.armReconcile();
    }, delay);
  }
}

export function resolveFallbackPollMs(override?: number): number {
  return override ?? FALLBACK_POLL_MS;
}

export function resolveReconcileMs(override?: number): number {
  return override ?? RECONCILE_MS;
}
