/**
 * Measure the metric-backed indicators of the catalog against a live metrics
 * backend. Each measure counts good and total events over the window it is
 * asked for (an SLO's 7 days, or an alert's 5 minutes), by the catalog's
 * PromQL, and answers `totals` for the objective check. A share of samples
 * (each a run of a check from outside) answers one event per run instead,
 * so its objective can be judged in time slices. A backend that
 * answers nothing is zero events, which the check reads as no evidence; a
 * backend that cannot be reached or refuses the query is an error with its
 * reason. Neither is ever a pass.
 */

import type { PrometheusClient } from '@pkgs/observability-root-shared-ts/prometheus';
import { PrometheusQueryError } from '@pkgs/observability-root-shared-ts/prometheus';
import type { Measure } from '@pkgs/openslo-shared-ts/registry';
import { ObservabilitySecretName } from './secret-names';
import type { MetricIndicator } from './slo-indicators';
import { isSampled, metricIndicators } from './slo-indicators';
import { sampleSelector, windowQueries } from './slo-promql';

export type MetricSettings = {
  readonly baseUrl: string;
  readonly user: string;
  readonly token: string;
};

const NAMES = [
  ObservabilitySecretName.prometheusUrl,
  ObservabilitySecretName.prometheusUser,
  ObservabilitySecretName.tempoToken,
] as const;

/**
 * The read credentials for the metrics backend, or the setup error that
 * names what is missing and where it comes from.
 */
export function metricSettings(
  vars: Readonly<Record<string, string | undefined>>
): MetricSettings {
  const missing = NAMES.filter((name) => (vars[name]?.trim() ?? '') === '');
  if (missing.length > 0) {
    throw new PrometheusQueryError(
      `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set in the environment's secrets. The service level objectives read the metrics backend with the stack's read token; Release stores these once foundation has been applied, and \`bun run secrets:seed\` shows what a store holds.`
    );
  }
  return {
    baseUrl: vars[ObservabilitySecretName.prometheusUrl]?.trim() ?? '',
    user: vars[ObservabilitySecretName.prometheusUser]?.trim() ?? '',
    token: vars[ObservabilitySecretName.tempoToken]?.trim() ?? '',
  };
}

/** One measure per named indicator, all answering from the same backend. */
export function metricMeasures(input: {
  readonly client: PrometheusClient;
  /** The environment whose requests are counted (`deployment.environment.name`). */
  readonly environment: string;
  readonly slis: readonly string[];
}): Readonly<Record<string, Measure>> {
  if (input.environment.trim() === '') {
    throw new Error('observability: metric measures need an environment');
  }
  const cache = new Map<string, Promise<number>>();
  const sum = (query: string, atMs: number): Promise<number> => {
    const key = `${String(atMs)} ${query}`;
    const found = cache.get(key);
    if (found !== undefined) return found;
    const answer = input.client
      .instant(query, atMs)
      .then((samples) => total(samples.map((s) => s.value)));
    cache.set(key, answer);
    return answer;
  };
  const measures: Record<string, Measure> = {};
  for (const sli of input.slis) {
    const indicator = metricIndicators().find((i) => i.sli === sli);
    if (indicator === undefined) {
      throw new Error(`observability: no metric indicator named ${sli}`);
    }
    measures[sli] = isSampled(indicator)
      ? samplesOf(indicator, input.environment, input.client)
      : measureOf(indicator, input.environment, sum);
  }
  return measures;
}

/**
 * The run a sample belongs to. A Health run records every check at one
 * moment; Synthetic Monitoring's checks run on their own clocks, so a
 * minute is one round of them.
 */
function runOf(indicator: MetricIndicator, atMs: number): number {
  return indicator.cadence === 'sparse' ? atMs : Math.floor(atMs / 60_000);
}

/** Whether one sample is good: the check read 1, or it was within the bound. */
function goodSample(indicator: MetricIndicator, value: number): boolean {
  if (!Number.isFinite(value)) {
    throw new PrometheusQueryError(
      `Prometheus answered ${String(value)} for a check's sample`
    );
  }
  return indicator.kind === 'sample-under'
    ? value <= indicator.underSeconds
    : value >= 1;
}

/**
 * Every run of the window, good when every check in it was good. One check
 * failing in every run (one broken game among thirteen) makes every run bad,
 * so it burns the budget as fast as the whole app failing would.
 */
function samplesOf(
  indicator: MetricIndicator,
  environment: string,
  client: PrometheusClient
): Measure {
  return async ({ startMs, endMs }) => {
    const seconds = Math.round((endMs - startMs) / 1000);
    const series = await client.series(
      sampleSelector({ indicator, window: `${String(seconds)}s`, environment }),
      endMs
    );
    const runs = new Map<number, { atMs: number; good: boolean }>();
    for (const point of series.flatMap((each) => each.points)) {
      const key = runOf(indicator, point.atMs);
      const good = goodSample(indicator, point.value);
      const seen = runs.get(key);
      runs.set(key, {
        atMs: Math.max(seen?.atMs ?? point.atMs, point.atMs),
        good: (seen?.good ?? true) && good,
      });
    }
    const events = [...runs.values()].sort((a, b) => a.atMs - b.atMs);
    return { kind: 'events', events };
  };
}

function measureOf(
  indicator: MetricIndicator,
  environment: string,
  sum: (query: string, atMs: number) => Promise<number>
): Measure {
  return async ({ startMs, endMs }) => {
    const seconds = Math.round((endMs - startMs) / 1000);
    const queries = windowQueries({
      indicator,
      window: `${String(seconds)}s`,
      environment,
    });
    const [good, all] = await Promise.all([
      sum(queries.good, endMs),
      sum(queries.total, endMs),
    ]);
    // Two series are extrapolated separately, so good can pass total by a hair.
    return { kind: 'totals', good: Math.min(good, all), total: all };
  };
}

/** `sum()` answers one sample, or none when nothing matched. */
function total(values: readonly number[]): number {
  let sum = 0;
  for (const value of values) {
    if (!Number.isFinite(value) || value < 0) {
      throw new PrometheusQueryError(
        `Prometheus answered ${String(value)} for a count of events`
      );
    }
    sum += value;
  }
  return sum;
}
