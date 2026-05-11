import { writeLastLocalAccountId } from './account-local-state';
import type { DeviceService } from './device-service';
import type { ConfigService } from './config-service-types';
import { fetchAuthWhoAmI } from './better-auth-fetch-auth-whoami';
import {
  finalizeLocalSignInAfterServerAccount,
  type EnsureProfileFn,
} from './finalize-local-sign-in';
import {
  clearLocalAuthMirrors,
  type LocalAuthCleanupDeps,
} from './local-auth-cleanup';
import { writeSessionToken } from './session-token-storage';
import type { Logger } from '@gamezilla/lib/logger/logger';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SyncPatchDb } from '@gamezilla/patch-db/impl-sync/impl-sync';
import type { SubscribablePatchDbLike } from '@gamezilla/patch-db/subscribable';

import type { AccountIdModel } from './account-id-context';
import type { SessionTokenModel } from './session-token-context';
import type { SessionService } from './session-service';

export type HostedSessionSyncRuntime = {
  secure: SecureStorage;
  sessionToken: SessionTokenModel;
  accountId: AccountIdModel;
  loggerRoot: Logger;
  getDeviceService: () => DeviceService;
  getConfigService: () => ConfigService;
  getSessionService: () => SessionService;
  getDb: () => SubscribablePatchDbLike;
  getSync: () => SyncPatchDb;
};

type SyncArgs = {
  isLoaded: boolean;
  isSignedIn: boolean;
  getSessionToken: () => Promise<string | null>;
  lastSyncedRef: { current: string | null };
  ensureProfile: EnsureProfileFn;
  runtime: HostedSessionSyncRuntime;
};

export async function runHostedSessionSync(args: SyncArgs): Promise<void> {
  if (!args.isLoaded) {
    return;
  }
  if (!args.isSignedIn) {
    await handleHostedSignedOut(args);
    return;
  }
  await handleHostedSignedIn(args);
}

function toMirrorDeps(r: HostedSessionSyncRuntime): LocalAuthCleanupDeps {
  return {
    logger: r.loggerRoot,
    secure: r.secure,
    sessionToken: r.sessionToken,
    accountId: r.accountId,
    getSessionService: r.getSessionService,
    getSync: r.getSync,
  };
}

async function handleHostedSignedOut(args: SyncArgs): Promise<void> {
  const { lastSyncedRef, runtime } = args;
  lastSyncedRef.current = null;
  const hadLocal =
    runtime.sessionToken.getSessionToken() !== null ||
    runtime.accountId.getAccountId() !== null;
  if (hadLocal) {
    await clearLocalAuthMirrors(toMirrorDeps(runtime));
  }
}

async function handleHostedSignedIn(args: SyncArgs): Promise<void> {
  const { getSessionToken, lastSyncedRef, ensureProfile, runtime } = args;
  const token = await getSessionToken();
  if (token === null || token.length === 0) {
    return;
  }

  const storage = runtime.secure;
  await writeSessionToken(storage, token);
  runtime.sessionToken.setSessionToken(token);

  if (lastSyncedRef.current === token) {
    return;
  }

  const log = runtime.loggerRoot.child({ namespace: 'hosted_auth_bridge' });
  const deviceService = runtime.getDeviceService();
  const deviceId = deviceService.getDeviceId();
  const config = runtime.getConfigService();

  try {
    const { accountId } = await fetchAuthWhoAmI({
      apiUrl: config.getApiUrl(),
      bearerToken: token,
      deviceId,
    });
    runtime.accountId.setAccountId(accountId);
    await writeLastLocalAccountId(storage, accountId);
    await finalizeLocalSignInAfterServerAccount({
      db: runtime.getDb(),
      deviceId,
      accountId,
      ensureProfile,
      deps: {
        storage,
        refreshSession: async () => {
          await runtime.getSessionService().refresh();
        },
      },
    });
    lastSyncedRef.current = token;
  } catch (e) {
    logWhoamiFailed(log, e);
  }
}

function logWhoamiFailed(log: Logger, e: unknown): void {
  log.error('hosted_auth_whoami_failed', {
    error: e instanceof Error ? e.message : String(e),
  });
}
