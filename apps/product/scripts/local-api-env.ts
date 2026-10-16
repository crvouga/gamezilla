import { HARNESS_AUTH_SECRET } from '@libs/sub-shared/harness-constants';
import { localProcessEnv } from './local-process-env';

export const LOCAL_MONITOR_TOKEN =
  'localhost-synthetic-monitor-only-000000000000';

/** API identity is shared with the harness that verifies stack sessions. */
export function localApiEnv(
  source: Readonly<Record<string, string | undefined>>
) {
  return {
    ...localProcessEnv(source),
    SECRETS_ENV: 'dev',
    AUTH_SECRET: HARNESS_AUTH_SECRET,
    SYNTHETIC_MONITOR_TOKEN: LOCAL_MONITOR_TOKEN,
  };
}
