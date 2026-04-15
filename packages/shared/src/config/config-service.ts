import { assert } from '../assert';
import type { InjectionToken } from '../dependency-injection/dependency-injection-container';

export interface ConfigService {
  getApiUrl(): string;
}

export const ConfigServiceToken: InjectionToken<ConfigService> =
  Symbol('ConfigService');

function createConfigService(): ConfigService {
  const apiUrl = process.env['EXPO_PUBLIC_API_URL'];
  assert.ok(
    typeof apiUrl === 'string' && apiUrl.length > 0,
    'EXPO_PUBLIC_API_URL must be set'
  );
  assert.notThrows(() => new URL(apiUrl), 'Invalid API URL', { apiUrl });

  return {
    getApiUrl(): string {
      return apiUrl;
    },
  };
}

export { createConfigService };
