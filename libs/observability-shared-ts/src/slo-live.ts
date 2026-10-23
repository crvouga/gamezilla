/**
 * Measure the metric-backed indicators of the catalog against a live metrics
 * backend. Each measure counts good and total events over the window it is
 * asked for (an SLO's 28 days, or an alert's 5 minutes), by the catalog's
 * PromQL, and answers `totals` for the objective check. A backend that
 * answers nothing is zero events, which the check reads as no evidence; a
 * backend that cannot be reached or refuses the query is an error with its
 * reason. Neither is ever a pass.
 */

import type { PrometheusClient } from '@pkgs/observability-root-shared-ts/prometheus';
import { PrometheusQueryError } from '@pkgs/observability-root-shared-ts/prometheus';
import type { Measure } from '@pkgs/openslo-shared-ts/registry';
import { ObservabilitySecretName } from './secret-names';
import type { MetricIndicator } from './slo-indicators';
import { metricIndicators } from './slo-indicators';
import { windowQueries } from './slo-promql';

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
      `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set in the environment's secrets. The service level objectives read the metrics backend with the stack's read token; Deploy stores these once foundation has been applied, and \`bun run secrets:seed\` shows what a store holds.`
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
    measures[sli] = measureOf(indicator, input.environment, sum);
  }
  return measures;
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
