/**
 * Where an alert sends the person who answers it, inside Grafana: Explore
 * already scoped to the environment's server error logs and failed traces.
 * Paths only; OpenTofu prefixes the instance URL. `__ENVIRONMENT__` is
 * replaced by the environment being applied, as in the rule's expression.
 */

import { parseDuration } from '@pkgs/openslo-shared-ts/window';
import { SERVER_SERVICE_NAME } from './service-names';

export const ENVIRONMENT_PLACEHOLDER = '__ENVIRONMENT__';

const LOGS_UID = 'grafanacloud-logs';
const TRACES_UID = 'grafanacloud-traces';

function explorePath(pane: unknown): string {
  return `/explore?schemaVersion=1&orgId=1&panes=${encodeURIComponent(JSON.stringify({ a: pane }))}`;
}

/** Explore on the environment's server error logs over `lookback`. */
export function logsPath(lookback: string): string {
  return explorePath({
    datasource: LOGS_UID,
    queries: [
      {
        refId: 'A',
        datasource: { type: 'loki', uid: LOGS_UID },
        expr: `{service_name="${SERVER_SERVICE_NAME}",deployment_environment_name="${ENVIRONMENT_PLACEHOLDER}"} | severity_text="ERROR"`,
      },
    ],
    range: { from: `now-${lookback}`, to: 'now' },
  });
}

/** Explore on the environment's failed server traces over `lookback`. */
export function tracesPath(lookback: string): string {
  return explorePath({
    datasource: TRACES_UID,
    queries: [
      {
        refId: 'A',
        datasource: { type: 'tempo', uid: TRACES_UID },
        queryType: 'traceql',
        query: `{resource.service.name="${SERVER_SERVICE_NAME}" && resource.deployment.environment.name="${ENVIRONMENT_PLACEHOLDER}" && status=error}`,
      },
    ],
    range: { from: `now-${lookback}`, to: 'now' },
  });
}

/** Explore looks back no further than Tempo keeps. */
export function exploreLookback(lookback: string): string {
  const ms = parseDuration(lookback) ?? 0;
  return ms > (parseDuration('3d') ?? 0) ? '3d' : lookback;
}
