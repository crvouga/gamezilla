import { HARNESS_AUTH_SECRET } from '@libs/sub-shared/harness-constants';
import { localProcessEnv } from './local-process-env';

/** API identity is shared with the harness that verifies stack sessions. */
export function localApiEnv(
  source: Readonly<Record<string, string | undefined>>
) {
  return {
    ...localProcessEnv(source),
    SECRETS_ENV: 'dev',
    AUTH_SECRET: HARNESS_AUTH_SECRET,
  };
}
