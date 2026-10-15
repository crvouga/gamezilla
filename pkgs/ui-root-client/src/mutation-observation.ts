import type { useTimers } from '@pkgs/clock-client/solid';
import { MutationOutcomeUnknownError } from './mutation-outcome-unknown-error';

export type MutationObservationSnapshot = {
  readonly phase: 'idle' | 'loading' | 'success' | 'error';
  readonly error: Error | null;
};

type Observation = {
  readonly promise: Promise<void>;
  readonly finish: () => void;
};
type ObservationArgs = {
  readonly operation: () => Promise<void>;
  readonly timers: ReturnType<typeof useTimers>;
  readonly onError?: ((error: Error) => void) | undefined;
};

/** Observes one choice without submitting it again while its outcome is unknown. */
export class MutationObservation {
  private snapshot: MutationObservationSnapshot = {
    phase: 'idle',
    error: null,
  };
  private readonly listeners = new Set<() => void>();
  private pending = false;
  private disposed = false;
  private observation: Observation | null = null;
  private timer: unknown = null;

  constructor(private readonly args: ObservationArgs) {}
  getSnapshot = (): MutationObservationSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  run = (): Promise<void> => {
    if (this.disposed) return Promise.resolve();
    if (this.observation !== null) return this.observation.promise;
    let finish!: () => void;
    const promise = new Promise<void>((resolve) => {
      finish = resolve;
    });
    this.observation = { promise, finish };
    this.publish('loading', null);
    this.timer = this.args.timers.setTimeout(() => {
      this.timer = null;
      this.publish('error', new MutationOutcomeUnknownError());
      this.finishObservation();
    }, 15_000);
    if (!this.pending) {
      this.pending = true;
      this.startOperation();
    }
    return promise;
  };

  reset = (): void => {
    if (this.pending || this.disposed) return;
    this.publish('idle', null);
  };

  dispose = (): void => {
    this.disposed = true;
    this.finishObservation();
    this.listeners.clear();
  };

  private startOperation(): void {
    try {
      void this.args.operation().then(
        () => this.settle(null),
        (error: unknown) => this.settle(this.asError(error))
      );
    } catch (error) {
      this.settle(this.asError(error));
    }
  }

  private asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private settle(error: Error | null): void {
    this.pending = false;
    if (!this.disposed)
      this.publish(error === null ? 'success' : 'error', error);
    this.finishObservation();
  }

  private finishObservation(): void {
    if (this.timer !== null) this.args.timers.clearTimeout(this.timer);
    this.timer = null;
    const observation = this.observation;
    this.observation = null;
    observation?.finish();
  }

  private publish(
    phase: MutationObservationSnapshot['phase'],
    error: Error | null
  ): void {
    this.snapshot = { phase, error };
    for (const listener of this.listeners) listener();
    if (error !== null) this.args.onError?.(error);
  }
}
