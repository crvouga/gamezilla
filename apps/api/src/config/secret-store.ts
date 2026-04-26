import { assert } from '@gamezilla/lib/assert';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import {
  createCachingSecretStore,
  createCombinedSecretStore,
  DopplerSecretStore,
} from '@gamezilla/lib/secret-store';

type RuntimeDopplerConfigName = 'local' | 'prod';

function selectRuntimeConfigName(request: Request): RuntimeDopplerConfigName {
  const host = new URL(request.url).hostname.toLowerCase();
  return host === 'api.gamezilla.app' ? 'prod' : 'local';
}

export type ApiSecretStoreFactory = {
  readonly configName: RuntimeDopplerConfigName;
  createFor(configName: RuntimeDopplerConfigName): SecretStore;
};

/**
 * Builds app-level SecretStore instances backed by Doppler env+shared configs.
 */
export function createApiSecretStoreFactory(
  token: string,
  request: Request
): ApiSecretStoreFactory {
  const configName = selectRuntimeConfigName(request);
  const sharedStore = new DopplerSecretStore({ token, configName: 'shared' });

  return {
    configName,
    createFor(requestedConfigName) {
      assert.ok(
        requestedConfigName === configName,
        `SecretStore config mismatch: selected ${configName}, requested ${requestedConfigName}`
      );
      const envStore = new DopplerSecretStore({
        token,
        configName: requestedConfigName,
      });
      const combinedStore = createCombinedSecretStore(envStore, sharedStore);
      return createCachingSecretStore(combinedStore, { ttlMs: 60_000 });
    },
  };
}
