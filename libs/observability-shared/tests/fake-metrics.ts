/**
 * A stand-in metrics backend for the queries the catalog generates: it reads
 * `sum(increase(<series>{<labels>}[<window>]) * on(job, instance) group_left
 * target_info{deployment_environment_name="<env>"})` and nothing else, and
 * answers from a table of series with a constant rate. A query of any other
 * shape throws, so a change in what the generator writes is noticed here
 * instead of being quietly answered. It stands for a deployment's counters,
 * not for PromQL.
 */

import { HISTOGRAM_BOUNDARIES } from '@pkgs/observability-root-shared/metric-contract';
import type {
  InstantSample,
  PrometheusClient,
} from '@pkgs/observability-root-shared/prometheus';

export type Series = {
  readonly name: string;
  readonly labels: Readonly<Record<string, string>>;
  /** The environment whose `target_info` this series joins. */
  readonly environment: string;
  readonly perSecond: number;
};

const QUERY =
  /^sum\(increase\(([a-z_:0-9]+)\{(.*)\}\[(\d+)(s|m|h|d)\]\) \* on\(job, instance\) group_left target_info\{deployment_environment_name="([^"]*)"\}\)$/;
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

export function fakeMetrics(series: readonly Series[]): FakeMetrics {
  const queries: { query: string; atMs: number }[] = [];
  return {
    queries,
    async instant(query, atMs): Promise<readonly InstantSample[]> {
      queries.push({ query, atMs });
      const match = QUERY.exec(query);
      if (match === null) {
        throw new Error(`the fake metrics backend cannot read: ${query}`);
      }
      const [
        ,
        name = '',
        body = '',
        count = '0',
        unit = 's',
        environment = '',
      ] = match;
      const seconds =
        Number(count) * UNIT_SECONDS[unit as keyof typeof UNIT_SECONDS];
      const clauses = [...body.matchAll(CLAUSE)].map(
        ([, label = '', op = '', value = '']) => ({ label, op, value })
      );
      const chosen = series.filter(
        (row) =>
          row.name === name &&
          row.environment === environment &&
          clauses.every(({ label, op, value }) =>
            holds(op, { job: 'gamezilla-server', ...row.labels }[label], value)
          )
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
