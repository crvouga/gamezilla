// @io-wall-ok — composition root: the wall clock and timers, the real HTTP client, the read credentials from the process env.
/**
 * The live objectives' view of the deployment: the metrics backend the
 * environment's read token opens, asked through the real HTTP client with a
 * deadline on every query. Nothing is read until a measure runs, so a missing
 * credential fails the objective that needs it, by name, and never the import
 * of every other objective's binding.
 */

import { envFile } from '@libs/infra-shared/envs';
import { alertingBinding } from '@libs/observability-shared/slo-alerts';
import {
  metricMeasures,
  metricSettings,
} from '@libs/observability-shared/slo-live';
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import { createDeadlineFetch } from '@pkgs/http-client-shared/deadline-fetch';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';
import { createPrometheusClient } from '@pkgs/observability-root-shared/prometheus';
import type { Measure, ObjectivesBinding } from '@pkgs/openslo-shared/registry';

/** A 28 day question over every request is slow to answer; a hung one is not waited for. */
const QUERY_DEADLINE_MS = 60_000;

/** Measures for these indicators, built when the first one is asked. */
function liveMeasures(
  slis: readonly string[]
): Readonly<Record<string, Measure>> {
  let opened: Readonly<Record<string, Measure>> | undefined;
  const open = (): Readonly<Record<string, Measure>> => {
    opened ??= metricMeasures({
      client: createPrometheusClient({
        ...metricSettings(process.env),
        fetch: createDeadlineFetch({
          fetch: createGlobalHttpClient().fetch,
          timers: wallTimers,
          timeoutMs: QUERY_DEADLINE_MS,
        }),
      }),
      environment: envFile(process.env['SECRETS_ENV']?.trim() || 'dev').env,
      slis,
    });
    return opened;
  };
  return Object.fromEntries(
    slis.map((sli): [string, Measure] => [
      sli,
      async (context) => {
        const measure = open()[sli];
        if (measure === undefined) throw new Error(`no measure for ${sli}`);
        return measure(context);
      },
    ])
  );
}

/** What binds a file whose indicators all come from the catalog's metrics. */
export function liveMetricBinding(input: {
  readonly spec: string;
  readonly slis: readonly string[];
}): ObjectivesBinding {
  return {
    spec: input.spec,
    layer: 'release',
    measure: liveMeasures(input.slis),
    nowMs: () => wallClock.now(),
    alerting: alertingBinding(),
  };
}
