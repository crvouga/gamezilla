import type { ResourceMetrics } from '@opentelemetry/sdk-metrics';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import {
  type AggregateIdentity,
  type AggregateLimits,
  type AggregateTotals,
  addIncrements,
  EMPTY_TOTALS,
  planExport,
} from './metric-aggregate';
import type { MetricBatch } from './metric-increments';

/**
 * Durable storage of the aggregate. `write` is all or nothing: a hand-off's
 * increments and the record that it was added are stored together or not at
 * all.
 */
export type MetricAggregateStorage = {
  readonly read: () => Promise<ReadonlyMap<string, unknown>>;
  readonly write: (change: {
    readonly put: Readonly<Record<string, unknown>>;
    readonly remove: readonly string[];
  }) => Promise<void>;
  /** Wake the aggregate at `atMs` to export, unless a wake is already set. */
  readonly wakeAt: (atMs: number) => Promise<void>;
};

export type MetricAggregateConfig = {
  readonly limits: AggregateLimits;
  readonly identity: AggregateIdentity;
  readonly exportEveryMs: number;
  /**
   * How long a writer's last sequence number is remembered after its last
   * hand-off. A hand-off older than half of this is refused as expired, so
   * a retry can never arrive after its writer was forgotten and be added
   * a second time.
   */
  readonly rememberWriterMs: number;
  /** The most writers remembered at once; a new one waits beyond it. */
  readonly writers: number;
};

export type MetricAggregateDeps = {
  readonly storage: MetricAggregateStorage;
  readonly clock: Clock;
  /** Sends one payload to the metrics backend; rejects unless acknowledged. */
  readonly send: (payload: ResourceMetrics) => Promise<void>;
};

export type AddOutcome =
  | { readonly status: 'added'; readonly refused: number }
  | { readonly status: 'duplicate' }
  | { readonly status: 'expired' }
  | { readonly status: 'busy' };

type Writer = { readonly sequence: number; readonly seenMs: number };
type Held = { totals: AggregateTotals; writers: Map<string, Writer> };

/** What writers handed over since the last export; rewritten by each. */
const WAITING_KEY = 'waiting';
/** What the backend was last told; rewritten once per export. */
const SENT_KEY = 'sent';
const WRITER_PREFIX = 'writer:';

/**
 * The single writer of a deployment's metrics. Short-lived writers hand it
 * what they counted; it keeps the running totals durably and is the only
 * thing that tells the metrics backend, under one identity.
 *
 * Operations run one at a time, each waiting for the one before it. That is
 * sound where every operation shares one I/O context (a Durable Object),
 * unlike the invocations of a stateless Worker. Memory changes only after
 * storage accepted the change, and is reread after a failed write, so what
 * is exported is never ahead of what a restart would recover: a total
 * cannot go backwards.
 */
export class MetricAggregateStore {
  readonly #deps: MetricAggregateDeps;
  readonly #config: MetricAggregateConfig;
  #held: Held | null = null;
  #turn: Promise<unknown> = Promise.resolve();

  constructor(deps: MetricAggregateDeps, config: MetricAggregateConfig) {
    this.#deps = deps;
    this.#config = config;
  }

  /** Add a hand-off to the totals, at most once per writer and sequence. */
  add(batch: MetricBatch): Promise<AddOutcome> {
    return this.#inTurn(async () => {
      const held = await this.#load();
      const nowMs = this.#deps.clock.now();
      const writer = held.writers.get(batch.writer);
      if (writer !== undefined && batch.sequence <= writer.sequence) {
        // Its first delivery may have ended before the wake was set.
        await this.#deps.storage.wakeAt(nowMs + this.#config.exportEveryMs);
        return { status: 'duplicate' };
      }
      if (nowMs - batch.createdAtMs > this.#config.rememberWriterMs / 2)
        return { status: 'expired' };
      if (writer === undefined && held.writers.size >= this.#config.writers)
        return { status: 'busy' };
      const { totals, refused } = addIncrements(
        held.totals,
        { service: batch.service, increments: batch.increments, nowMs },
        this.#config.limits
      );
      const seen = { sequence: batch.sequence, seenMs: nowMs };
      await this.#write({
        put: {
          [WAITING_KEY]: totals.waiting,
          [WRITER_PREFIX + batch.writer]: seen,
        },
        remove: [],
      });
      held.totals = totals;
      held.writers.set(batch.writer, seen);
      await this.#deps.storage.wakeAt(nowMs + this.#config.exportEveryMs);
      return { status: 'added', refused };
    });
  }

  /**
   * Tell the backend the totals. Returns whether it acknowledged them. A
   * refused or unanswered export leaves the totals as they were and asks to
   * be woken again; so does one that still has increments to state.
   */
  exportTotals(): Promise<boolean> {
    return this.#inTurn(async () => {
      const held = await this.#load();
      const nowMs = this.#deps.clock.now();
      const next = planExport(held.totals, nowMs, this.#config);
      const again = nowMs + this.#config.exportEveryMs;
      try {
        for (const payload of next.payloads) await this.#deps.send(payload);
      } catch {
        await this.#deps.storage.wakeAt(again);
        return false;
      }
      const forgotten = [...held.writers]
        .filter(
          ([, writer]) => nowMs - writer.seenMs > this.#config.rememberWriterMs
        )
        .map(([name]) => name);
      await this.#write({
        put: {
          [WAITING_KEY]: next.acknowledged.waiting,
          [SENT_KEY]: {
            sent: next.acknowledged.sent,
            sentAtMs: next.acknowledged.sentAtMs,
          },
        },
        remove: forgotten.map((name) => WRITER_PREFIX + name),
      });
      held.totals = next.acknowledged;
      for (const name of forgotten) held.writers.delete(name);
      if (Object.keys(next.acknowledged.waiting).length > 0)
        await this.#deps.storage.wakeAt(again);
      return true;
    });
  }

  #inTurn<T>(work: () => Promise<T>): Promise<T> {
    const result = this.#turn.then(work);
    this.#turn = result.catch(() => undefined);
    return result;
  }

  async #load(): Promise<Held> {
    if (this.#held !== null) return this.#held;
    const stored = await this.#deps.storage.read();
    const writers = new Map<string, Writer>();
    for (const [key, value] of stored) {
      if (key.startsWith(WRITER_PREFIX))
        writers.set(key.slice(WRITER_PREFIX.length), value as Writer);
    }
    const sent = stored.get(SENT_KEY) as
      | Pick<AggregateTotals, 'sent' | 'sentAtMs'>
      | undefined;
    const waiting = stored.get(WAITING_KEY) as
      | AggregateTotals['waiting']
      | undefined;
    this.#held = {
      totals: { ...EMPTY_TOTALS, ...sent, ...(waiting ? { waiting } : {}) },
      writers,
    };
    return this.#held;
  }

  async #write(change: {
    readonly put: Readonly<Record<string, unknown>>;
    readonly remove: readonly string[];
  }): Promise<void> {
    try {
      await this.#deps.storage.write(change);
    } catch (error) {
      this.#held = null;
      throw error;
    }
  }
}
