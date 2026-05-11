/**
 * Wires concrete feature factories (auth, profile, http client) into the
 * client-runtime leaf at app start. Must run before any code reads the
 * runtime atoms (`secureStorageAtom`, `deviceServiceAtom`, …).
 *
 * Module-level side effect so `import '@gamezilla/client/runtime/bootstrap-client-runtime'`
 * is enough to register; no provider tree required.
 */
import {
  deleteAccountLocalData,
  deleteAnonymousDatabaseFileBestEffort,
  openAccountDb,
  openAnonymousDb,
} from '@gamezilla/auth/client/account-db';
import {
  readLastLocalAccountId,
  writeLastLocalAccountId,
} from '@gamezilla/auth/client/account-local-state';
import { createSecureStorage } from '@gamezilla/auth/client/create-secure-storage';
import { createDeviceService } from '@gamezilla/auth/client/device-service';
import { ensureDeviceEntity } from '@gamezilla/auth/client/ensure-device-entity';
import { createSessionService } from '@gamezilla/auth/client/session-service';
import { readSessionToken } from '@gamezilla/auth/client/session-token-storage';
import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  assertDeviceId,
} from '@gamezilla/auth/shared';
import { ensureProfile } from '@gamezilla/profile/client/ensure-profile-entity';
import {
  initRuntimeFactories,
  type PatchDbHcTransportFactory,
} from '@gamezilla/client-runtime/runtime-factories';
import { createApiClient, type ApiClient } from '@gamezilla/client/api/hc';
import { createPatchDbHcTransport } from '@gamezilla/client/api/patch-db-hc-transport';

const transportFactory: PatchDbHcTransportFactory = (apiClient, options) =>
  createPatchDbHcTransport(apiClient as ApiClient, options);

initRuntimeFactories({
  createSecureStorage,
  createDeviceService,
  createSessionService,
  ensureDeviceEntity,
  ensureProfile,
  readSessionToken,
  readLastLocalAccountId,
  writeLastLocalAccountId,
  deleteAccountLocalData,
  deleteAnonymousDatabaseFileBestEffort,
  openAccountDb,
  openAnonymousDb,
  assertDeviceId,
  accountSessionEntityType: ACCOUNT_SESSION_ENTITY_TYPE,
  createApiClient,
  createPatchDbHcTransport: transportFactory,
});
