import { assert } from '@gamezilla/lib/assert';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import {
  createCachingSecretStore,
  createCombinedSecretStore,
  DopplerSecretStore,
} from '@gamezilla/lib/secret-store';

export type RuntimeDopplerConfigName = 'local' | 'prod';

function selectRuntimeConfigName(request: Request): RuntimeDopplerConfigName {
  const host = new URL(request.url).hostname.toLowerCase();
  return host === 'api.gamezilla.app' ? 'prod' : 'local';
}

export type ApiSecretStoreFactory = {
  readonly configName: RuntimeDopplerConfigName;
  createFor(configName: RuntimeDopplerConfigName): SecretStore;
};

export function createApiSecretStoreForConfig(
  token: string,
  configName: RuntimeDopplerConfigName
): SecretStore {
  const envStore = new DopplerSecretStore({ token, configName });
  const sharedStore = new DopplerSecretStore({ token, configName: 'shared' });
  const combinedStore = createCombinedSecretStore(envStore, sharedStore);
  return createCachingSecretStore(combinedStore, { ttlMs: 60_000 });
}

/**
 * Builds app-level SecretStore instances backed by Doppler env+shared configs.
 */
export function createApiSecretStoreFactory(
  token: string,
  request: Request
): ApiSecretStoreFactory {
  const configName = selectRuntimeConfigName(request);

  return {
    configName,
    createFor(requestedConfigName) {
      assert.ok(
        requestedConfigName === configName,
        `SecretStore config mismatch: selected ${configName}, requested ${requestedConfigName}`
      );
      return createApiSecretStoreForConfig(token, requestedConfigName);
    },
  };
}
