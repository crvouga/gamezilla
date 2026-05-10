import { writeLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import { writeSessionToken } from './session-token-storage';
import {
  finalizeLocalSignInAfterServerAccount,
  type EnsureProfileFn,
} from './finalize-local-sign-in';
import { clearLocalAuthMirrors } from './local-auth-cleanup';
import {
  accountIdAtom,
  configServiceAtom,
  deviceServiceAtom,
  loggerAtom,
  patchDbStackAtom,
  secureStorageAtom,
  sessionTokenAtom,
} from '@gamezilla/client/runtime/atoms';
import type { Logger } from '@gamezilla/lib/logger/logger';
import type { getDefaultStore } from 'jotai';
import { fetchAuthWhoAmI } from './better-auth-fetch-auth-whoami';

type JotaiStore = ReturnType<typeof getDefaultStore>;

type SyncArgs = {
  store: JotaiStore;
  isLoaded: boolean;
  isSignedIn: boolean;
  getSessionToken: () => Promise<string | null>;
  lastSyncedRef: { current: string | null };
  ensureProfile: EnsureProfileFn;
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

async function handleHostedSignedOut(args: SyncArgs): Promise<void> {
  const { store, lastSyncedRef } = args;
  lastSyncedRef.current = null;
  const hadLocal =
    store.get(sessionTokenAtom) !== null || store.get(accountIdAtom) !== null;
  if (hadLocal) {
    await clearLocalAuthMirrors();
  }
}

async function handleHostedSignedIn(args: SyncArgs): Promise<void> {
  const { store, getSessionToken, lastSyncedRef } = args;
  const token = await getSessionToken();
  if (token === null || token.length === 0) {
    return;
  }

  const storage = store.get(secureStorageAtom);
  await writeSessionToken(storage, token);
  store.set(sessionTokenAtom, token);

  if (lastSyncedRef.current === token) {
    return;
  }

  const log = store.get(loggerAtom).child({ namespace: 'hosted_auth_bridge' });
  const deviceService = await store.get(deviceServiceAtom);
  const deviceId = deviceService.getDeviceId();
  const config = store.get(configServiceAtom);

  try {
    const { accountId } = await fetchAuthWhoAmI({
      apiUrl: config.getApiUrl(),
      bearerToken: token,
      deviceId,
    });
    store.set(accountIdAtom, accountId);
    await writeLastLocalAccountId(storage, accountId);
    const stack = await store.get(patchDbStackAtom);
    await finalizeLocalSignInAfterServerAccount({
      db: stack.db,
      deviceId,
      accountId,
      ensureProfile: args.ensureProfile,
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
