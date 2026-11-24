import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { AggregateIdentity } from '@pkgs/observability-aggregate-server-ts/metric-aggregate';
import {
  type MetricAggregateConfig,
  type MetricAggregateDeps,
  type MetricAggregateStorage,
  MetricAggregateStore,
} from '@pkgs/observability-aggregate-server-ts/metric-aggregate-store';
import {
  type MetricHandoff,
  MetricHandoffExporter,
  type MetricHandoffOptions,
  type MetricHandoffOutcome,
} from '@pkgs/observability-aggregate-server-ts/metric-handoff-exporter';
import { parseMetricBatch } from '@pkgs/observability-aggregate-server-ts/metric-increments';
import { acknowledgedMetricExporter } from '@pkgs/observability-runtime-shared-ts/acknowledged-metric-exporter';

/** The name of the one aggregate instance in its namespace. */
export const METRIC_AGGREGATE_NAME = 'aggregate';
/** The one `service.instance.id` aggregated series carry. */
export const METRIC_AGGREGATE_INSTANCE_ID = 'aggregate';

const ADD_PATH = '/add';
const HANDOFF_DEADLINE_MS = 10_000;
/** Storage takes at most this many keys in one call. */
const STORAGE_CHUNK = 128;

/**
 * The defaults: export once a minute; begin totals again after two missed
 * exports (well inside the shortest window an objective reads); forget a
 * series nobody added to for a day; remember a writer for an hour after its
 * last hand-off.
 */
export const METRIC_AGGREGATE_DEFAULTS = {
  exportEveryMs: 60_000,
  rememberWriterMs: 3_600_000,
  writers: 20_000,
  restartAfterMs: 150_000,
  forgetAfterMs: 86_400_000,
  series: 2048,
} as const;

/** The part of a Durable Object's storage the aggregate uses. */
export type MetricAggregateObjectStorage = {
  list(): Promise<Map<string, unknown>>;
  put(entries: Record<string, unknown>): Promise<void>;
  delete(keys: string[]): Promise<number>;
  getAlarm(): Promise<number | null>;
  setAlarm(ms: number): Promise<void>;
};

export type MetricAggregateObjectState = {
  readonly storage: MetricAggregateObjectStorage;
};

/** The binding a writer reaches the aggregate through. */
export type MetricAggregateNamespace = {
  idFromName(name: string): object;
  get(id: object): { fetch: (request: Request) => Promise<Response> };
};

export type MetricAggregateSettings = {
  /** The only services whose hand-offs are added. */
  readonly services: readonly string[];
  /** The only labels a series may carry. */
  readonly attributeKeys: readonly string[];
  readonly seriesPerMetric: number;
  readonly identity: AggregateIdentity;
  /** Sends one payload to the metrics backend; rejects unless acknowledged. */
  readonly send: MetricAggregateDeps['send'];
};

/** Sends to an OTLP/HTTP metrics endpoint and reads its acknowledgement. */
export function metricBackendSend(
  endpoint: {
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
  },
  http: HttpClient,
  timers: Timers
): MetricAggregateDeps['send'] {
  const exporter = acknowledgedMetricExporter(
    endpoint.url,
    http,
    timers,
    endpoint.headers
  );
  return (payload) =>
    new Promise<void>((resolve, reject) => {
      exporter.export(payload, (outcome) => {
        if (outcome.code === 0) resolve();
        else reject(outcome.error ?? new Error('Metric export failed'));
      });
    });
}

function chunks<T>(items: readonly T[]): readonly (readonly T[])[] {
  const result: T[][] = [];
  for (let at = 0; at < items.length; at += STORAGE_CHUNK)
    result.push(items.slice(at, at + STORAGE_CHUNK));
  return result;
}

/**
 * Writes issued without waiting in between are stored together or not at
 * all: the platform commits them as one.
 */
export function metricAggregateStorage(
  storage: MetricAggregateObjectStorage
): MetricAggregateStorage {
  return {
    read: () => storage.list(),
    async write({ put, remove }) {
      const writes: Promise<unknown>[] = [];
      for (const entries of chunks(Object.entries(put)))
        writes.push(storage.put(Object.fromEntries(entries)));
      for (const keys of chunks(remove)) writes.push(storage.delete([...keys]));
      await Promise.all(writes);
    },
    async wakeAt(atMs) {
      if ((await storage.getAlarm()) === null) await storage.setAlarm(atMs);
    },
  };
}

function storeConfig(settings: MetricAggregateSettings): MetricAggregateConfig {
  const defaults = METRIC_AGGREGATE_DEFAULTS;
  return {
    identity: settings.identity,
    exportEveryMs: defaults.exportEveryMs,
    rememberWriterMs: defaults.rememberWriterMs,
    writers: defaults.writers,
    limits: {
      seriesPerMetric: settings.seriesPerMetric,
      series: defaults.series,
      restartAfterMs: defaults.restartAfterMs,
      forgetAfterMs: defaults.forgetAfterMs,
    },
  };
}

/**
 * The Durable Object class that is a deployment's single metrics writer.
 * Every Worker isolate hands it what it counted; it alone exports, from its
 * alarm. `settings` returns `null` where no metrics backend is configured.
 */
export function createMetricAggregateDurableObject<Env>(options: {
  readonly clock: Clock;
  readonly settings: (env: Env) => MetricAggregateSettings | null;
}) {
  return class MetricAggregateDurableObject {
    readonly #settings: MetricAggregateSettings | null;
    readonly #store: MetricAggregateStore | null;

    constructor(state: MetricAggregateObjectState, env: Env) {
      this.#settings = options.settings(env);
      this.#store =
        this.#settings === null
          ? null
          : new MetricAggregateStore(
              {
                storage: metricAggregateStorage(state.storage),
                clock: options.clock,
                send: this.#settings.send,
              },
              storeConfig(this.#settings)
            );
    }

    async fetch(request: Request): Promise<Response> {
      const settings = this.#settings;
      const store = this.#store;
      if (
        request.method !== 'POST' ||
        new URL(request.url).pathname !== ADD_PATH
      )
        return new Response(null, { status: 404 });
      if (settings === null || store === null)
        return new Response(null, { status: 503 });
      const body: unknown = await request.json().catch(() => null);
      const parsed = parseMetricBatch(body, {
        services: settings.services,
        attributeKeys: settings.attributeKeys,
        maxIncrements: METRIC_AGGREGATE_DEFAULTS.series,
      });
      if (parsed === null) return new Response(null, { status: 400 });
      const outcome = await store.add(parsed.batch);
      if (outcome.status === 'busy') return new Response(null, { status: 503 });
      return Response.json(
        outcome.status === 'added'
          ? { status: 'added', refused: outcome.refused + parsed.refused }
          : outcome
      );
    }

    async alarm(): Promise<void> {
      // A failed export has already asked to be woken again.
      await this.#store?.exportTotals();
    }
  };
}

function outcomeOf(document: unknown): MetricHandoffOutcome {
  if (document !== null && typeof document === 'object') {
    const { status, refused } = document as Record<string, unknown>;
    if (status === 'duplicate' || status === 'expired') return { status };
    if (status === 'added' && typeof refused === 'number')
      return { status, refused };
  }
  throw new Error('Metric aggregate gave no outcome');
}

/**
 * Hands a writer's increments to the aggregate. Anything but a stated
 * outcome rejects, and the writer keeps the hand-off to deliver again.
 */
export function metricAggregateHandoff(
  namespace: MetricAggregateNamespace,
  timers: Timers
): MetricHandoff {
  return async (batch) => {
    const aggregate = namespace.get(
      namespace.idFromName(METRIC_AGGREGATE_NAME)
    );
    let timer: unknown;
    let unanswered = false;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = timers.setTimeout(() => {
        unanswered = true;
        reject(new Error('Metric aggregate did not answer'));
      }, HANDOFF_DEADLINE_MS);
    });
    const answer = aggregate.fetch(
      new Request(`https://metric-aggregate${ADD_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(batch),
      })
    );
    try {
      const response = await Promise.race([answer, deadline]);
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(
          `Metric aggregate refused the hand-off (${response.status})`
        );
      }
      return outcomeOf(await response.json());
    } finally {
      timers.clearTimeout(timer);
      // An answer that arrives after the deadline is still released.
      if (unanswered)
        void answer.then(
          (late) => late.body?.cancel(),
          () => undefined
        );
    }
  };
}

/**
 * A short-lived writer's metric exporter: it hands what the writer counted
 * to the aggregate behind `namespace` and stores no series of its own.
 */
export function createMetricHandoffExporter(
  namespace: MetricAggregateNamespace,
  timers: Timers,
  writer: Omit<MetricHandoffOptions, 'handoff'>
): MetricHandoffExporter {
  return new MetricHandoffExporter({
    ...writer,
    handoff: metricAggregateHandoff(namespace, timers),
  });
}
