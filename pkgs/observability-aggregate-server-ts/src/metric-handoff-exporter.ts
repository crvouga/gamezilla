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

/** The most hand-offs one flush delivers before leaving the rest to the next. */
const TURNS = 8;
/**
 * A flush that has been delivering for this long has ended without saying so
 * (its invocation was torn down mid hand-off), and the next flush takes over.
 */
const ABANDONED_AFTER_MS = 15_000;

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
 *
 * One flush delivers at a time, and a flush never waits for another's I/O:
 * each belongs to its own invocation, which cannot join a different one's.
 * A flush that finds one delivering leaves its increments waiting; the
 * delivering flush takes them along, or the writer's next flush does.
 */
export class MetricHandoffExporter implements PushMetricExporter {
  readonly #options: MetricHandoffOptions;
  #waiting = new Map<string, MetricIncrement>();
  #inDoubt: MetricBatch | null = null;
  #sequence = 0;
  #delivering: { readonly sinceMs: number } | null = null;
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
    const nowMs = this.#options.clock.now();
    const delivering = this.#delivering;
    if (
      delivering !== null &&
      nowMs - delivering.sinceMs <= ABANDONED_AFTER_MS
    ) {
      done({ code: 0 });
      return;
    }
    const turn = { sinceMs: nowMs };
    this.#delivering = turn;
    void this.#deliver(turn).then(
      () => done({ code: 0 }),
      (cause: unknown) =>
        done({
          code: 1,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
    );
  }

  async forceFlush(): Promise<void> {
    // Delivery belongs to the flush that started it; nothing here to join.
  }

  async shutdown(): Promise<void> {
    this.#closed = true;
  }

  /** Increments counted but not yet known to be in the totals. */
  get undelivered(): number {
    return this.#waiting.size + (this.#inDoubt?.increments.length ?? 0);
  }

  async #deliver(turn: { readonly sinceMs: number }): Promise<void> {
    try {
      for (let sent = 0; sent < TURNS; sent += 1) {
        const batch = this.#inDoubt ?? this.#nextBatch();
        if (batch === null) return;
        const outcome = await this.#options.handoff(batch);
        // Another flush took over while this one was unanswered: the batch
        // and what follows are its to settle.
        if (this.#delivering !== turn) return;
        this.#inDoubt = null;
        this.#settled(batch, outcome);
      }
    } finally {
      if (this.#delivering === turn) this.#delivering = null;
    }
  }

  #nextBatch(): MetricBatch | null {
    if (this.#waiting.size === 0) return null;
    this.#sequence += 1;
    this.#inDoubt = {
      writer: this.#options.writer,
      sequence: this.#sequence,
      createdAtMs: this.#options.clock.now(),
      service: this.#options.service,
      increments: [...this.#waiting.values()],
    };
    this.#waiting = new Map();
    return this.#inDoubt;
  }

  #settled(batch: MetricBatch, outcome: MetricHandoffOutcome): void {
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
