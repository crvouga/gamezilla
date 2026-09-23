import type { ConfigService } from '@libs/auth/public/config-service-types';

import { getServerBaseUrl } from './api-servers';

export type CreateConfigServiceArgs = {
  /** Override the API base URL (sims wire an in-process origin, e.g. `'http://sim.local'`). */
  readonly apiUrl?: string;
};

export function createConfigService(
  args: CreateConfigServiceArgs = {}
): ConfigService {
  const apiUrl = args.apiUrl;
  return {
    getApiUrl(): string {
      return apiUrl ?? getServerBaseUrl();
    },
  };
}
