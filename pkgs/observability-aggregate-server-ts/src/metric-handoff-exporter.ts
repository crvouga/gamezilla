import {
  AggregationTemporality,
  type PushMetricExporter,
  type ResourceMetrics,
} from '@opentelemetry/sdk-metrics';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import {
  incrementKey,
  incrementsOf,
  type MetricBatch,
  type MetricIncrement,
  mergeIncrement,
} from './metric-increments';

/**
 * What the aggregate said about a hand-off. `added` and `duplicate` both mean
 * the totals hold it; `refused` counts increments the aggregate left out
 * because their series would exceed its bounds. `expired` means the aggregate
 * will never take it (it is older than the aggregate remembers hand-offs
 * for), so the writer lets go.
 */
export type MetricHandoffOutcome =
  | { readonly status: 'added'; readonly refused: number }
  | { readonly status: 'duplicate' }
  | { readonly status: 'expired' };

/** Delivers one hand-off; rejects when the outcome is unknown. */
export type MetricHandoff = (
  batch: MetricBatch
) => Promise<MetricHandoffOutcome>;

export type MetricHandoffOptions = {
  /** Unique to this writer for its whole life (one Worker isolate). */
  readonly writer: string;
  readonly service: string;
  readonly clock: Clock;
  readonly handoff: MetricHandoff;
  /** Told when counted increments are given up, so the loss is never silent. */
  readonly onLost?: (lost: {
    readonly sequence: number;
    readonly increments: number;
  }) => void;
};

type Outcome = { readonly code: 0 | 1; readonly error?: Error };

/**
 * A short-lived writer's metric exporter: it sends what it counted since its
 * last flush to the one aggregate, instead of storing series of its own.
 *
 * At most one hand-off is in doubt at a time. It keeps its sequence number
 * and its exact contents until the aggregate answers, so a retry after a
 * lost answer is recognized and added once. Whatever is counted meanwhile
 * waits in the next hand-off. Both are bounded by the label vocabulary, not
 * by how long the aggregate stays unreachable. Increments still waiting when
 * the writer itself ends are lost with it.
 */
export class MetricHandoffExporter implements PushMetricExporter {
  readonly #options: MetricHandoffOptions;
  #waiting = new Map<string, MetricIncrement>();
  #inDoubt: MetricBatch | null = null;
  #sequence = 0;
  #draining: Promise<void> = Promise.resolve();
  #closed = false;

  constructor(options: MetricHandoffOptions) {
    this.#options = options;
  }

  selectAggregationTemporality(): AggregationTemporality {
    return AggregationTemporality.DELTA;
  }

  export(collected: ResourceMetrics, done: (outcome: Outcome) => void): void {
    if (this.#closed) {
      done({ code: 1, error: new Error('Metric hand-off is closed') });
      return;
    }
    for (const increment of incrementsOf(collected)) {
      const key = incrementKey(this.#options.service, increment);
      const earlier = this.#waiting.get(key);
      this.#waiting.set(
        key,
        earlier === undefined ? increment : mergeIncrement(earlier, increment)
      );
    }
    const drained = this.#draining.then(() => this.#drain());
    this.#draining = drained.catch(() => undefined);
    void drained.then(
      () => done({ code: 0 }),
      (cause: unknown) =>
        done({
          code: 1,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
    );
  }

  async forceFlush(): Promise<void> {
    await this.#draining;
  }

  async shutdown(): Promise<void> {
    this.#closed = true;
    await this.#draining;
  }

  /** Increments counted but not yet known to be in the totals. */
  get undelivered(): number {
    return this.#waiting.size + (this.#inDoubt?.increments.length ?? 0);
  }

  async #drain(): Promise<void> {
    for (;;) {
      if (this.#inDoubt === null) {
        if (this.#waiting.size === 0) return;
        this.#sequence += 1;
        this.#inDoubt = {
          writer: this.#options.writer,
          sequence: this.#sequence,
          createdAtMs: this.#options.clock.now(),
          service: this.#options.service,
          increments: [...this.#waiting.values()],
        };
        this.#waiting = new Map();
      }
      const batch = this.#inDoubt;
      const outcome = await this.#options.handoff(batch);
      this.#inDoubt = null;
      const lost =
        outcome.status === 'expired'
          ? batch.increments.length
          : outcome.status === 'added'
            ? outcome.refused
            : 0;
      if (lost > 0)
        this.#options.onLost?.({ sequence: batch.sequence, increments: lost });
    }
  }
}
