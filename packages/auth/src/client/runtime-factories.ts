/**
 * Dependency-injection seam: the Expo app calls {@link initRuntimeFactories}
 * at bootstrap; the client data plane reads concrete factories via
 * {@link getRuntimeFactories}.
 */
import type { PatchDb } from '@gamezilla/patch-db/interface';
import type { PatchDbClientTransport } from '@gamezilla/patch-db/transport/interface';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import type { DeviceService } from './device-service';
import type { SessionService } from './session-service';

export type EnsureProfileFn = (db: PatchDb, accountId: string) => Promise<void>;

export type ApiClient = unknown;

export type PatchDbHcTransportFactory = (
  apiClient: ApiClient,
  options: {
    patchDbBaseUrl: string;
    getAuthToken: () => string | null;
    getAnonId: () => string;
  }
) => PatchDbClientTransport;

export type RuntimeFactories = {
  createSecureStorage: () => SecureStorage;
  createDeviceService: (storage: SecureStorage) => Promise<DeviceService>;
  createSessionService: (
    db: PatchDb,
    deviceService: DeviceService
  ) => SessionService;
  ensureDeviceEntity: (db: PatchDb, deviceId: string) => Promise<void>;
  ensureProfile: EnsureProfileFn;
  readSessionToken: (storage: SecureStorage) => Promise<string | null>;
  readLastLocalAccountId: (storage: SecureStorage) => Promise<string | null>;
  writeLastLocalAccountId: (
    storage: SecureStorage,
    accountId: string | null
  ) => Promise<void>;
  deleteAccountLocalData: (accountId: string) => Promise<void>;
  deleteAnonymousDatabaseFileBestEffort: (deviceId: string) => Promise<void>;
  openAccountDb: (accountId: string) => Promise<SqlClient>;
  openAnonymousDb: (deviceId: string) => Promise<SqlClient>;
  assertDeviceId: (id: string) => void;
  accountSessionEntityType: string;
  createApiClient: (apiUrl: string) => ApiClient;
  createPatchDbHcTransport: PatchDbHcTransportFactory;
};

let _factories: RuntimeFactories | null = null;

export function initRuntimeFactories(factories: RuntimeFactories): void {
  _factories = factories;
}

export function getRuntimeFactories(): RuntimeFactories {
  if (_factories === null) {
    throw new Error(
      'Runtime factories not initialized — call initRuntimeFactories at app bootstrap before the client data plane mounts.'
    );
  }
  return _factories;
}
