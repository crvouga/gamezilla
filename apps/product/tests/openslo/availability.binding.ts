// @io-wall-ok — composition root: the wall clock, the real HTTP client, GitHub credentials from the process env.
/**
 * `specs/health/availability.openslo.yaml`, measured for the environment
 * the run targets (`SECRETS_ENV`, as the live world reads it): the Health
 * workflow's `health:<env>` jobs over the objective's window, read from the
 * GitHub REST API (`health-job-results.ts`). Needs `GITHUB_TOKEN` with
 * `actions: read`; `GITHUB_REPOSITORY` and `GITHUB_API_URL` come with every
 * Actions job.
 */

import { envFile } from '@libs/infra/public/envs';
import { wallClock } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { bindObjectives } from '@pkgs/openslo/registry';
import { healthCheckEvents } from './health-job-results';

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
          token: required('GITHUB_TOKEN'),
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
