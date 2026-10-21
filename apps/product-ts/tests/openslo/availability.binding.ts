// @io-wall-ok — composition root: the wall clock, the real HTTP client, GitHub credentials from the process env.
/** Availability is measured from GitHub Actions Health job attempts. */

import { envFile } from '@libs/infra-shared-ts/envs';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { healthCheckEvents, healthHistoryToken } from './health-job-results';

function required(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (value.length === 0) {
    throw new Error(
      `${name} is not set — the team's checks are read from GitHub Actions`
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
            process.env['GITHUB_API_URL']?.trim() || 'https://api.github.com',
          repository: required('GITHUB_REPOSITORY'),
          token: healthHistoryToken(process.env),
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
