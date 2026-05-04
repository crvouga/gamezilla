import {
  reopenPatchDbAsAccount,
  reopenPatchDbAsAnonymous,
} from '@gamezilla/client/ui/patch-db-lifecycle-api';
import {
  getPatchDbForAuthWrites,
  getSessionServiceForAuth,
} from '@gamezilla/client/ui/patch-runtime-ref';
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
import type { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import type { AuthAccountIdHolder } from './auth-account-id-holder';
import type { AuthSessionTokenHolder } from './auth-session-token-holder';
import { ensureAccountProfile } from './ensure-profile-entity';
import { AuthConfigurationError } from './auth-errors';
import type { DeviceService } from './device-service';
import { postGoogleAuthClaim } from './google-claim';

export interface AuthService {
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthServiceToken: InjectionToken<AuthService> =
  Symbol('AuthService');

type CreateAuthServiceDeps = {
  configService: ConfigService;
  deviceService: DeviceService;
  accountIdHolder: AuthAccountIdHolder;
  sessionTokenHolder: AuthSessionTokenHolder;
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
    accountIdHolder,
    sessionTokenHolder,
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

    // Stamp the bearer token before any patch-db sync push fires; otherwise
    // the unsynced session/device patches would 401 against the server.
    sessionTokenHolder.set(sessionToken);

    await reopenPatchDbAsAccount(accountId);
    accountIdHolder.set(accountId);

    const sessionEntityId = globalThis.crypto.randomUUID();
    const db = getPatchDbForAuthWrites();

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

    await ensureAccountProfile(db, accountId);
    await getSessionServiceForAuth().refresh();
  };
}

export function createAuthService(deps: CreateAuthServiceDeps): AuthService {
  return {
    signInWithGoogle: createGoogleSignInHandler(deps),
    async signOut(): Promise<void> {
      await getSessionServiceForAuth().clearSession();
      deps.accountIdHolder.set(null);
      deps.sessionTokenHolder.set(null);
      await reopenPatchDbAsAnonymous();
    },
  };
}
