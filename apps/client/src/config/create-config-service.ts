import type { ConfigService } from '@gamezilla/auth/client/config-service-types';

import { getApiBaseUrl } from './api-servers';

export function createConfigService(): ConfigService {
  const apiUrl = getApiBaseUrl();
  return {
    getApiUrl(): string {
      return apiUrl;
    },
  };
}
