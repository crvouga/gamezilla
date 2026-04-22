import type { InjectionToken } from '../dependency-injection/dependency-injection-container';
import { getApiBaseUrl } from './api-servers';

export interface ConfigService {
  getApiUrl(): string;
}

export const ConfigServiceToken: InjectionToken<ConfigService> =
  Symbol('ConfigService');

function createConfigService(): ConfigService {
  const apiUrl = getApiBaseUrl();
  return {
    getApiUrl(): string {
      return apiUrl;
    },
  };
}

export { createConfigService };
