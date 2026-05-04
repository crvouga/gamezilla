import { deleteAnonymousDatabaseFileBestEffort } from '@gamezilla/client/db/account-db';
import { ensureServerClientId } from '@gamezilla/client/db/ensure-server-client-id';
import { writeLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import {
  accountIdAtom,
  loggerAtom,
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
import type {
  PatchDb,
  WritePatchesResult,
} from '@gamezilla/patch-db/interface';
import { getDefaultStore } from 'jotai';
import { ensureDeviceEntity } from './ensure-device-entity';
import { ensureAccountProfile } from './ensure-profile-entity';
import { AuthConfigurationError } from './auth-errors';
import type { DeviceService } from './device-service';
import { postGoogleAuthClaim } from './google-claim';
import { writeSessionToken } from './session-token-storage';
import { postAuthSignOut } from './sign-out-request';

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

type ClaimResult = {
  accountId: string;
  sessionToken: string;
  expiresAt: string;
  sessionEntityId: string;
};

async function writeSessionAndDevice(args: {
  db: PatchDb;
  deviceId: string;
  claim: ClaimResult;
}): Promise<WritePatchesResult> {
  const { db, deviceId, claim } = args;
  return await db.write([
    {
      entityId: deviceId,
      entityType: DEVICE_ENTITY_TYPE,
      attributes: {
        [DeviceAttr.accountId]: claim.accountId,
      },
    },
    {
      entityId: claim.sessionEntityId,
      entityType: ACCOUNT_SESSION_ENTITY_TYPE,
      attributes: {
        [AccountSessionAttr.deviceId]: deviceId,
        [AccountSessionAttr.accountId]: claim.accountId,
        [AccountSessionAttr.token]: claim.sessionToken,
        [AccountSessionAttr.expiresAt]: claim.expiresAt,
        [AccountSessionAttr.createdAt]: new Date().toISOString(),
      },
    },
  ]);
}

async function finalizeSignIn(args: {
  apiUrl: string;
  db: PatchDb;
  deviceId: string;
  accountId: string;
}): Promise<void> {
  const { apiUrl, db, deviceId, accountId } = args;
  const store = getDefaultStore();
  const storage = store.get(secureStorageAtom);
  await writeLastLocalAccountId(storage, accountId);
  const clientId = await ensureServerClientId(apiUrl, storage);
  await deleteAnonymousDatabaseFileBestEffort(clientId);
  // Refresh the device row with full platform metadata; the partial write
  // in writeSessionAndDevice only stamps the account binding so sync push
  // has the linkage immediately.
  await ensureDeviceEntity(db, deviceId);
  await ensureAccountProfile(db, accountId);
  const sessionSvc = await store.get(sessionServiceAtom);
  await sessionSvc.refresh();
}

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
    const claim = await postGoogleAuthClaim({
      apiUrl,
      googleIdToken,
      deviceId,
    });
    assertUuid(claim.accountId, 'claim response accountId must be UUID');
    assert.ok(
      claim.sessionToken.length > 0,
      'claim response sessionToken must be non-empty'
    );

    const store = getDefaultStore();
    const storage = store.get(secureStorageAtom);
    await writeSessionToken(storage, claim.sessionToken);
    store.set(sessionTokenAtom, claim.sessionToken);
    store.set(accountIdAtom, claim.accountId);

    const patchStack = await store.get(patchDbStackAtom);
    const { db, sync } = patchStack;

    const sessionWrite = await writeSessionAndDevice({ db, deviceId, claim });
    const sessionPatchIds = sessionWrite.accepted
      .filter((p) => p.entityType === ACCOUNT_SESSION_ENTITY_TYPE)
      .map((p) => p.patchId);
    await sync.markPatchesAsAlreadyOnRemote(sessionPatchIds);

    await finalizeSignIn({
      apiUrl,
      db,
      deviceId,
      accountId: claim.accountId,
    });
  };
}

/**
 * Sign-out is **always authoritative locally**. The order is:
 *
 * 1. Best-effort `POST /auth/sign-out` so the server-side session row is
 *    revoked (via system context) while we still have the Bearer. Failures
 *    (offline, 5xx) are logged and swallowed; local revoke happens regardless.
 * 2. Local revoke writes (cached session cleared via `sessionService`).
 *    These flow through patch-db and land in the unsynced outbox.
 * 3. Drop **every** unsynced `accountSession` patch — both full-row mirrors
 *    from a previous claim and revoke-shaped patches from step 2. Mirrors are
 *    server-authoritative; revokes have already been applied server-side in
 *    step 1 (or will never push successfully because step 1 invalidated the
 *    Bearer). Either way, leaving them in the outbox guarantees
 *    `accountSession is system-managed` rejections on the next push.
 * 4. Clear the Bearer + accountId atoms + secure storage **last**. This is
 *    the only writer of `sessionTokenAtom` / `accountIdAtom` on sign-out so
 *    the auth-context subscription cannot race ahead and null the Bearer
 *    before the server call runs.
 *
 * `signOut` does not throw under normal use (offline, server 5xx, etc.). It
 * only propagates programmer-error assertions.
 */
function createSignOutHandler(
  deps: Pick<CreateAuthServiceDeps, 'configService'>
): AuthService['signOut'] {
  const { configService } = deps;
  return async function signOut(): Promise<void> {
    const store = getDefaultStore();
    const log = store.get(loggerAtom);
    const storage = store.get(secureStorageAtom);
    const apiUrl = configService.getApiUrl();
    const bearer = store.get(sessionTokenAtom);

    if (bearer !== null && bearer.length > 0) {
      try {
        await postAuthSignOut({ apiUrl, bearer });
      } catch (err) {
        log.warn('server sign-out best-effort failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const sessionSvc = await store.get(sessionServiceAtom);
    await sessionSvc.clearSession();

    const stack = await store.get(patchDbStackAtom);
    await stack.sync.markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
      ACCOUNT_SESSION_ENTITY_TYPE
    );

    await writeSessionToken(storage, null);
    await writeLastLocalAccountId(storage, null);
    store.set(sessionTokenAtom, null);
    store.set(accountIdAtom, null);
  };
}

export function createAuthService(deps: CreateAuthServiceDeps): AuthService {
  return {
    signInWithGoogle: createGoogleSignInHandler(deps),
    signOut: createSignOutHandler(deps),
  };
}
