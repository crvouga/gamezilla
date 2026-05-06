import { writeLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import { finalizeLocalSignInAfterServerAccount } from '@gamezilla/client/auth/finalize-local-sign-in';
import { clearLocalAuthMirrors } from '@gamezilla/client/auth/local-auth-cleanup';
import { writeSessionToken } from '@gamezilla/client/auth/session-token-storage';
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
import { fetchAuthWhoAmI } from './fetch-auth-whoami';

type JotaiStore = ReturnType<typeof getDefaultStore>;

type SyncArgs = {
  store: JotaiStore;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  lastSyncedRef: { current: string | null };
};

export async function runClerkSessionSync(args: SyncArgs): Promise<void> {
  if (!args.isSignedIn) {
    await handleClerkSignedOut(args);
    return;
  }
  await handleClerkSignedIn(args);
}

async function handleClerkSignedOut(args: SyncArgs): Promise<void> {
  const { store, lastSyncedRef } = args;
  lastSyncedRef.current = null;
  const hadLocal =
    store.get(sessionTokenAtom) !== null || store.get(accountIdAtom) !== null;
  if (hadLocal) {
    await clearLocalAuthMirrors();
  }
}

async function handleClerkSignedIn(args: SyncArgs): Promise<void> {
  const { store, getToken, lastSyncedRef } = args;
  const token = await getToken();
  if (token === null || token.length === 0) {
    return;
  }

  const storage = store.get(secureStorageAtom);
  await writeSessionToken(storage, token);
  store.set(sessionTokenAtom, token);

  if (lastSyncedRef.current === token) {
    return;
  }

  const log = store.get(loggerAtom).child({ namespace: 'clerk_bridge' });
  const deviceService = await store.get(deviceServiceAtom);
  const deviceId = deviceService.getDeviceId();
  const config = store.get(configServiceAtom);

  try {
    const { accountId } = await fetchAuthWhoAmI({
      apiUrl: config.getApiUrl(),
      clerkJwt: token,
      deviceId,
    });
    store.set(accountIdAtom, accountId);
    await writeLastLocalAccountId(storage, accountId);
    const stack = await store.get(patchDbStackAtom);
    await finalizeLocalSignInAfterServerAccount({
      db: stack.db,
      deviceId,
      accountId,
    });
    lastSyncedRef.current = token;
  } catch (e) {
    logWhoamiFailed(log, e);
  }
}

function logWhoamiFailed(log: Logger, e: unknown): void {
  log.error('clerk_whoami_failed', {
    error: e instanceof Error ? e.message : String(e),
  });
}
