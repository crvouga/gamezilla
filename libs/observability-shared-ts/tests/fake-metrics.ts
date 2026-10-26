/**
 * A stand-in metrics backend for the queries the catalog generates: it reads
 * the counter count (`increase` of series that existed, plus the first value
 * of series that appeared, over `<window>`) and the range selector of a
 * check's samples, and nothing else. Counters answer from a table of series
 * with a constant rate that existed before any window (so only `increase`
 * counts); checks from a table of samples. A query of any other shape
 * throws, so a change in what the generator writes is noticed here instead
 * of being quietly answered. It stands for a deployment, not for PromQL.
 */

import { HISTOGRAM_BOUNDARIES } from '@pkgs/observability-root-shared-ts/metric-contract';
import type {
  InstantSample,
  PrometheusClient,
  SampledSeries,
} from '@pkgs/observability-root-shared-ts/prometheus';

export type Series = {
  readonly name: string;
  readonly labels: Readonly<Record<string, string>>;
  /** The environment each point names. */
  readonly environment: string;
  readonly perSecond: number;
};

/** A gauge series and every sample it holds. */
export type Samples = {
  readonly name: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly environment: string;
  readonly points: readonly { readonly atMs: number; readonly value: number }[];
};

const QUERY =
  /^\(\(sum\(increase\(([a-z_:0-9]+)\{(.*?)\}\[(\d+)(s|m|h|d)\]\)\) \+ sum\(min_over_time\(\1\{\2\}\[\3\4\]\) unless min_over_time\(\1\{\2\}\[\3\4\] offset \3\4\)\)\) or sum\(increase\(\1\{\2\}\[\3\4\]\)\) or sum\(min_over_time\(\1\{\2\}\[\3\4\]\) unless min_over_time\(\1\{\2\}\[\3\4\] offset \3\4\)\)\)$/;
const RANGE = /^([a-z_:0-9]+)\{(.*?)\}\[(\d+)(s|m|h|d)\]$/;
const CLAUSE = /([a-z_]+)(=~|!~|!=|=)"([^"]*)"/g;
const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86_400 } as const;

function holds(
  op: string,
  actual: string | undefined,
  wanted: string
): boolean {
  const value = actual ?? '';
  switch (op) {
    case '=':
      return value === wanted;
    case '!=':
      return value !== wanted;
    case '=~':
      return new RegExp(`^(?:${wanted})$`).test(value);
    default:
      return !new RegExp(`^(?:${wanted})$`).test(value);
  }
}

export type FakeMetrics = PrometheusClient & {
  readonly queries: { readonly query: string; readonly atMs: number }[];
};

function clausesOf(body: string) {
  return [...body.matchAll(CLAUSE)].map(
    ([, label = '', op = '', value = '']) => ({ label, op, value })
  );
}

function matches(
  row: {
    readonly labels: Readonly<Record<string, string>>;
    readonly environment: string;
  },
  clauses: ReturnType<typeof clausesOf>
): boolean {
  const labels: Record<string, string> = {
    ...row.labels,
    deployment_environment_name: row.environment,
  };
  return clauses.every(({ label, op, value }) =>
    holds(op, labels[label], value)
  );
}

export function fakeMetrics(
  series: readonly Series[],
  samples: readonly Samples[] = []
): FakeMetrics {
  const queries: { query: string; atMs: number }[] = [];
  return {
    queries,
    async series(query, atMs): Promise<readonly SampledSeries[]> {
      queries.push({ query, atMs });
      const match = RANGE.exec(query);
      if (match === null) {
        throw new Error(`the fake metrics backend cannot read: ${query}`);
      }
      const [, name = '', body = '', count = '0', unit = 's'] = match;
      const fromMs =
        atMs -
        Number(count) * UNIT_SECONDS[unit as keyof typeof UNIT_SECONDS] * 1000;
      const clauses = clausesOf(body);
      return samples
        .filter((row) => row.name === name && matches(row, clauses))
        .map((row) => ({
          labels: row.labels,
          points: row.points.filter((p) => p.atMs > fromMs && p.atMs <= atMs),
        }))
        .filter((row) => row.points.length > 0);
    },
    async instant(query, atMs): Promise<readonly InstantSample[]> {
      queries.push({ query, atMs });
      const match = QUERY.exec(query);
      if (match === null) {
        throw new Error(`the fake metrics backend cannot read: ${query}`);
      }
      const [, name = '', body = '', count = '0', unit = 's'] = match;
      const seconds =
        Number(count) * UNIT_SECONDS[unit as keyof typeof UNIT_SECONDS];
      const clauses = clausesOf(body);
      const chosen = series.filter(
        (row) => row.name === name && matches(row, clauses)
      );
      if (chosen.length === 0) return [];
      return [
        {
          labels: {},
          value: chosen.reduce((sum, row) => sum + row.perSecond * seconds, 0),
        },
      ];
    },
  };
}

export type Traffic = {
  readonly group: string;
  readonly statusClass: string;
  readonly perSecond: number;
  /** How long each of these requests took. */
  readonly seconds: number;
};

/** The request counter and duration histogram series a stream of traffic leaves. */
export function httpSeries(
  environment: string,
  traffic: readonly Traffic[]
): readonly Series[] {
  return traffic.flatMap((t): Series[] => {
    const labels = {
      http_request_method: 'GET',
      app_http_status_class: t.statusClass,
      app_http_route_group: t.group,
    };
    const base = { environment, labels, perSecond: t.perSecond };
    return [
      { ...base, name: 'http_server_requests_total' },
      { ...base, name: 'http_server_request_duration_seconds_count' },
      ...[...HISTOGRAM_BOUNDARIES, Number.POSITIVE_INFINITY]
        .filter((bound) => t.seconds <= bound)
        .map((bound) => ({
          ...base,
          name: 'http_server_request_duration_seconds_bucket',
          labels: {
            ...labels,
            le: Number.isFinite(bound) ? String(bound) : '+Inf',
          },
        })),
    ];
  });
}

export function replaySeries(
  environment: string,
  outcomes: Readonly<Record<string, number>>
): readonly Series[] {
  return Object.entries(outcomes).map(([outcome, perSecond]) => ({
    name: 'sync_mutation_replays_total',
    environment,
    labels: { app_mutation_outcome: outcome },
    perSecond,
  }));
}
