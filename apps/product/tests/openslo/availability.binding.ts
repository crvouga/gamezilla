// @io-wall-ok — composition root: the wall clock, the real HTTP client, Depot credentials from the process env.
/** Availability is measured from native Depot Health job attempts. */

import { envFile } from '@libs/infra-shared/envs';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';
import { bindObjectives } from '@pkgs/openslo-shared/registry';
import { healthCheckEvents, healthHistoryToken } from './health-job-results';

function required(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (value.length === 0) {
    throw new Error(
      `${name} is not set — the team's checks are read from Depot CI`
    );
  }
  return value;
}

bindObjectives({
  spec: 'availability',
  layer: 'release',
  measure: {
    'team-checks-passing': ({ startMs, endMs }) =>
      healthCheckEvents(
        {
          http: createGlobalHttpClient(),
          apiUrl:
            process.env['DEPOT_API_URL']?.trim() || 'https://api.depot.dev',
          repository: required('GITHUB_REPOSITORY'),
          token: healthHistoryToken(process.env),
          orgId: required('DEPOT_ORG_ID'),
        },
        {
          env: envFile(process.env['SECRETS_ENV']?.trim() || 'dev').env,
          startMs,
          endMs,
        }
      ),
  },
  nowMs: () => wallClock.now(),
});
