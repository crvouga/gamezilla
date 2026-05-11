/**
 * Dependency-injection seam between the feature packages (auth, profile, …)
 * and the `client-runtime` leaf. Composition root calls
 * {@link initRuntimeFactories} at app boot with all the concrete factories;
 * the leaf atoms then construct services lazily from this registry.
 *
 * Keeps `client-runtime` free of feature imports so it remains a true leaf.
 */
import type { PatchDb } from '@gamezilla/patch-db/interface';
import type { PatchDbClientTransport } from '@gamezilla/patch-db/transport/interface';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import type { DeviceService } from './device-service-interface';
import type { SessionService } from './session-service-interface';

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
  /** Persists non-encrypted device id + per-account small secrets. */
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
  /** Constant for the entity type that flags revoked sessions. */
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
      'client-runtime: runtime factories not initialized — call initRuntimeFactories at app bootstrap before atoms are read'
    );
  }
  return _factories;
}
