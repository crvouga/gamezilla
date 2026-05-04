import { deleteAnonymousDatabaseFileBestEffort } from '@gamezilla/client/db/account-db';
import { ensureServerClientId } from '@gamezilla/client/db/ensure-server-client-id';
import { writeLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import {
  accountIdAtom,
  patchDbStackAtom,
  secureStorageAtom,
  sessionServiceAtom,
  sessionTokenAtom,
} from '@gamezilla/client/runtime/atoms';
import {
  assertDeviceId,
  DEVICE_ENTITY_TYPE,
  ACCOUNT_SESSION_ENTITY_TYPE,
  DeviceAttr,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import { assertUuid } from '@gamezilla/domain/auth/device-id';
import type { ConfigService } from '@gamezilla/domain/config/config-service';
import { assert } from '@gamezilla/lib/assert';
import { getDefaultStore } from 'jotai';
import { ensureAccountProfile } from './ensure-profile-entity';
import { AuthConfigurationError } from './auth-errors';
import type { DeviceService } from './device-service';
import { postGoogleAuthClaim } from './google-claim';

export interface AuthService {
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

type CreateAuthServiceDeps = {
  configService: ConfigService;
  deviceService: DeviceService;
  /** When false, sign-in is refused before opening the Google prompt. */
  googleSignInAvailable: boolean;
  promptGoogleIdToken: () => Promise<string>;
};

function createGoogleSignInHandler(
  deps: CreateAuthServiceDeps
): AuthService['signInWithGoogle'] {
  const {
    configService,
    deviceService,
    googleSignInAvailable,
    promptGoogleIdToken,
  } = deps;

  return async function signInWithGoogle(): Promise<void> {
    if (!googleSignInAvailable) {
      throw new AuthConfigurationError();
    }
    const googleIdToken = await promptGoogleIdToken();
    assert.string(googleIdToken, 'Google id_token must be string');
    assert.ok(googleIdToken.length > 0, 'Google id_token must be non-empty');

    const deviceId = deviceService.getDeviceId();
    assertDeviceId(deviceId);

    const apiUrl = configService.getApiUrl();
    const { accountId, sessionToken, expiresAt } = await postGoogleAuthClaim({
      apiUrl,
      googleIdToken,
      deviceId,
    });
    assertUuid(accountId, 'claim response accountId must be UUID');
    assert.ok(
      sessionToken.length > 0,
      'claim response sessionToken must be non-empty'
    );

    const store = getDefaultStore();
    store.set(sessionTokenAtom, sessionToken);
    store.set(accountIdAtom, accountId);

    const patchStack = await store.get(patchDbStackAtom);
    const { db } = patchStack;

    const sessionEntityId = globalThis.crypto.randomUUID();
    await db.write([
      {
        entityId: deviceId,
        entityType: DEVICE_ENTITY_TYPE,
        attributes: {
          [DeviceAttr.accountId]: accountId,
        },
      },
      {
        entityId: sessionEntityId,
        entityType: ACCOUNT_SESSION_ENTITY_TYPE,
        attributes: {
          [AccountSessionAttr.deviceId]: deviceId,
          [AccountSessionAttr.accountId]: accountId,
          [AccountSessionAttr.token]: sessionToken,
          [AccountSessionAttr.expiresAt]: expiresAt,
          [AccountSessionAttr.createdAt]: new Date().toISOString(),
        },
      },
    ]);

    const storage = store.get(secureStorageAtom);
    await writeLastLocalAccountId(storage, accountId);
    const clientId = await ensureServerClientId(apiUrl, storage);
    await deleteAnonymousDatabaseFileBestEffort(clientId);

    await ensureAccountProfile(db, accountId);
    const sessionSvc = await store.get(sessionServiceAtom);
    await sessionSvc.refresh();
  };
}

export function createAuthService(deps: CreateAuthServiceDeps): AuthService {
  return {
    signInWithGoogle: createGoogleSignInHandler(deps),
    async signOut(): Promise<void> {
      const store = getDefaultStore();
      const sessionSvc = await store.get(sessionServiceAtom);
      await sessionSvc.clearSession();
      await writeLastLocalAccountId(store.get(secureStorageAtom), null);
      store.set(sessionTokenAtom, null);
      store.set(accountIdAtom, null);
    },
  };
}
