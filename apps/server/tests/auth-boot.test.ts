import { describe, expect, test } from 'bun:test';
import { loadAuthBootConfig } from '@apps/server/config/auth-boot';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';

const secretStore = createRecordSecretStore({
  AUTH_SECRET: 'local-auth-secret-long-enough-for-tests',
  API_URL: 'http://localhost:8788',
  WEB_CLIENT_GOOGLE_CLIENT_ID: 'google-client',
  WEB_CLIENT_GOOGLE_CLIENT_SECRET: 'google-secret',
});

describe('auth boot', () => {
  test('normal localhost offers Google without the dev account chooser', async () => {
    const config = await loadAuthBootConfig({
      secretStore,
      enableDev: false,
    });
    expect(config.googleEnabled).toBe(true);
    expect(config.enableDev).toBe(false);
    expect(config.providers.google).toBeDefined();
    expect(config.providers.dev).toBeUndefined();
  });

  test('simulated auth enables the dev account chooser', async () => {
    const config = await loadAuthBootConfig({ secretStore, enableDev: true });
    expect(config.enableDev).toBe(true);
    expect(config.providers.dev).toEqual({ enabled: true });
  });
});
