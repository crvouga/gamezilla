import type { ConfigService } from '@libs/auth/client/config-service-types';

import { getApiBaseUrl } from './api-servers';

export function createConfigService(): ConfigService {
  return {
    getApiUrl(): string {
      return getApiBaseUrl();
    },
  };
}
