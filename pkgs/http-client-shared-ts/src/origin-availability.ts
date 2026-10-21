import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';

import { createDeadlineFetch } from './deadline-fetch';
import { HttpAbortError } from './http-abort-error';
import { nextBackoffMs, probeHealthEndpoint } from './origin-health-probe';
import { hrefEquals, tryParseUrl } from './origin-href';
import type { HttpFetch } from './types';

export type OriginAvailabilityPhase = 'unavailable' | 'probing' | 'available';

export type OriginAvailabilityKind = 'health' | 'always';

export type OriginAvailabilitySnapshot = {
  readonly phase: OriginAvailabilityPhase;
  readonly lastLatencyMs: number | null;
  readonly healthUrl: string;
};

export type OriginAvailability = {
  readonly kind: OriginAvailabilityKind;
  getSnapshot(): OriginAvailabilitySnapshot;
  subscribe(listener: () => void): () => void;
  start(): void;
  stop(): void;
  waitUntilAvailable(signal?: AbortSignal | null): Promise<void>;
  noteNetworkFailure(): void;
  noteSuccess(): void;
  isHealthProbeUrl(href: string): boolean;
  matchesOrigin(href: string): boolean;
  refresh(): Promise<void>;
};

export type CreateHealthOriginAvailabilityArgs = {
  readonly healthUrl: string;
  readonly fetch: HttpFetch;
  readonly timers: Timers;
  readonly clock: Clock;
  readonly initialBackoffMs?: number;
  readonly maxBackoffMs?: number;
};

type Waiter = {
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
};

const DEFAULT_INITIAL_BACKOFF_MS = 1_000;
const DEFAULT_MAX_BACKOFF_MS = 30_000;

export function createAlwaysAvailableOrigin(args?: {
  readonly healthUrl?: string;
}): OriginAvailability {
  const healthUrl = args?.healthUrl ?? '';
  const snapshot: OriginAvailabilitySnapshot = {
    phase: 'available',
    lastLatencyMs: null,
    healthUrl,
  };
  return {
    kind: 'always',
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    start: () => undefined,
    stop: () => undefined,
    waitUntilAvailable: async () => undefined,
    noteNetworkFailure: () => undefined,
    noteSuccess: () => undefined,
    isHealthProbeUrl: () => false,
    matchesOrigin: () => false,
    refresh: async () => undefined,
  };
}

export function createHealthOriginAvailability(
  args: CreateHealthOriginAvailabilityArgs
): OriginAvailability {
  return new HealthOriginAvailability(args);
}

class HealthOriginAvailability implements OriginAvailability {
  readonly kind = 'health' as const;
  private readonly healthUrl: string;
  private readonly origin: string;
  private readonly fetchFn: HttpFetch;
  private readonly timers: Timers;
  private readonly clock: Clock;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly listeners = new Set<() => void>();
  private readonly waiters = new Set<Waiter>();
  private phase: OriginAvailabilityPhase = 'unavailable';
  private lastLatencyMs: number | null = null;
  private snapshot: OriginAvailabilitySnapshot;
  private started = false;
  private inFlight = false;
  private backoffMs: number;
  private timerHandle: unknown = null;
  private probeAbort: AbortController | null = null;

  constructor(args: CreateHealthOriginAvailabilityArgs) {
    this.healthUrl = args.healthUrl;
    this.fetchFn = createDeadlineFetch({
      fetch: args.fetch,
      timers: args.timers,
    });
    this.timers = args.timers;
    this.clock = args.clock;
    this.initialBackoffMs = args.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
    this.maxBackoffMs = args.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.backoffMs = this.initialBackoffMs;
    this.origin = tryParseUrl(args.healthUrl)?.origin ?? '';
    this.snapshot = {
      phase: this.phase,
      lastLatencyMs: this.lastLatencyMs,
      healthUrl: this.healthUrl,
    };
  }

  getSnapshot(): OriginAvailabilitySnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.phase !== 'available') {
      this.scheduleProbe(0);
    }
  }

  stop(): void {
    this.started = false;
    this.clearTimer();
    this.probeAbort?.abort();
    this.probeAbort = null;
    this.rejectWaiters(new HttpAbortError('Origin availability stopped'));
  }

  waitUntilAvailable(signal?: AbortSignal | null): Promise<void> {
    if (this.phase === 'available') return Promise.resolve();
    const abort = signal ?? undefined;
    if (abort?.aborted === true) {
      return Promise.reject(new HttpAbortError());
    }
    return this.enqueueWaiter(abort);
  }

  noteNetworkFailure(): void {
    if (this.phase !== 'available') return;
    this.backoffMs = this.initialBackoffMs;
    this.setPhase('unavailable');
    if (this.started) this.scheduleProbe(0);
  }

  noteSuccess(): void {
    this.backoffMs = this.initialBackoffMs;
    this.setPhase('available');
    this.resolveWaiters();
  }

  isHealthProbeUrl(href: string): boolean {
    return hrefEquals(href, this.healthUrl);
  }

  matchesOrigin(href: string): boolean {
    if (this.origin.length === 0) return false;
    const url = tryParseUrl(href);
    return url !== null && url.origin === this.origin;
  }

  async refresh(): Promise<void> {
    if (!this.started) return;
    this.backoffMs = this.initialBackoffMs;
    this.clearTimer();
    await this.runProbe({ silent: this.phase === 'available' });
  }

  private enqueueWaiter(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = { resolve, reject };
      this.waiters.add(waiter);
      const onAbort = () => {
        this.waiters.delete(waiter);
        reject(new HttpAbortError());
      };
      if (signal === undefined) return;
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private notify(): void {
    this.snapshot = {
      phase: this.phase,
      lastLatencyMs: this.lastLatencyMs,
      healthUrl: this.healthUrl,
    };
    for (const listener of this.listeners) listener();
  }

  private setPhase(phase: OriginAvailabilityPhase): void {
    if (this.phase === phase) {
      return;
    }
    this.phase = phase;
    this.notify();
  }

  private resolveWaiters(): void {
    const pending = [...this.waiters];
    this.waiters.clear();
    for (const waiter of pending) waiter.resolve();
  }

  private rejectWaiters(error: Error): void {
    const pending = [...this.waiters];
    this.waiters.clear();
    for (const waiter of pending) waiter.reject(error);
  }

  private clearTimer(): void {
    if (this.timerHandle === null) return;
    this.timers.clearTimeout(this.timerHandle);
    this.timerHandle = null;
  }

  private scheduleProbe(delayMs: number): void {
    this.clearTimer();
    if (!this.started || this.phase === 'available') return;
    if (delayMs <= 0) {
      if (this.inFlight) return;
      void this.runProbe({ silent: false });
      return;
    }
    this.timerHandle = this.timers.setTimeout(() => {
      this.timerHandle = null;
      void this.runProbe({ silent: false });
    }, delayMs);
  }

  private async runProbe(args: { readonly silent: boolean }): Promise<void> {
    if (!this.started || this.inFlight) return;
    this.inFlight = true;
    if (!args.silent) this.setPhase('probing');
    this.probeAbort = new AbortController();
    try {
      await this.finishProbe(args.silent);
    } finally {
      this.inFlight = false;
      this.probeAbort = null;
    }
  }

  private async finishProbe(silent: boolean): Promise<void> {
    try {
      const result = await probeHealthEndpoint({
        healthUrl: this.healthUrl,
        fetch: this.fetchFn,
        clock: this.clock,
        ...(this.probeAbort !== null ? { signal: this.probeAbort.signal } : {}),
      });
      if (!this.started) return;
      this.applyProbeResult(result, silent);
    } catch {
      if (!this.started) return;
      this.onProbeFailure();
    }
  }

  private applyProbeResult(
    result: { ok: boolean; latencyMs: number },
    silent: boolean
  ): void {
    if (result.ok) {
      this.lastLatencyMs = result.latencyMs;
      this.backoffMs = this.initialBackoffMs;
      this.setPhase('available');
      this.resolveWaiters();
      this.notify();
      return;
    }
    if (silent && this.phase === 'available') {
      this.onProbeFailure();
      return;
    }
    this.onProbeFailure();
  }

  private onProbeFailure(): void {
    this.lastLatencyMs = null;
    this.setPhase('unavailable');
    const delay = this.backoffMs;
    this.backoffMs = nextBackoffMs(this.backoffMs, this.maxBackoffMs);
    if (this.started) this.scheduleProbe(delay);
  }
}
