import { assert } from '@gamezilla/lib/assert';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import {
  createCachingSecretStore,
  DopplerSecretStore,
} from '@gamezilla/lib/secret-store';
import type { RuntimeEnvName } from './secret-names';

export type { RuntimeEnvName } from './secret-names';

export function selectRuntimeEnvName(request: Request): RuntimeEnvName {
  const host = new URL(request.url).hostname.toLowerCase();
  return host === 'api.gamezilla.app' ? 'prod' : 'local';
}

export type ApiSecretStoreFactory = {
  readonly runtimeEnv: RuntimeEnvName;
  createFor(runtimeEnv: RuntimeEnvName): SecretStore;
};

/**
 * Single Doppler config `shared`; env-specific values use prefixed secret names.
 */
export function createApiSecretStore(token: string): SecretStore {
  const store = new DopplerSecretStore({ token, configName: 'shared' });
  return createCachingSecretStore(store, { ttlMs: 60_000 });
}

/**
 * Builds app-level SecretStore backed by the shared Doppler config.
 * {@link ApiSecretStoreFactory.runtimeEnv} selects which prefixed URL keys callers use.
 */
export function createApiSecretStoreFactory(
  token: string,
  request: Request
): ApiSecretStoreFactory {
  const runtimeEnv = selectRuntimeEnvName(request);

  return {
    runtimeEnv,
    createFor(requestedRuntimeEnv) {
      assert.ok(
        requestedRuntimeEnv === runtimeEnv,
        `SecretStore runtime mismatch: selected ${runtimeEnv}, requested ${requestedRuntimeEnv}`
      );
      return createApiSecretStore(token);
    },
  };
}
