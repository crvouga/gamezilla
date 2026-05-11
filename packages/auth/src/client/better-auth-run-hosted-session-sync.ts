import { writeLastLocalAccountId } from './account-local-state';
import type { Logger } from '@gamezilla/lib/logger/logger';

import { getRegisteredClientStore } from './client-store-register';
import { fetchAuthWhoAmI } from './better-auth-fetch-auth-whoami';
import {
  finalizeLocalSignInAfterServerAccount,
  type EnsureProfileFn,
} from './finalize-local-sign-in';
import { clearLocalAuthMirrors } from './local-auth-cleanup';
import { writeSessionToken } from './session-token-storage';

type SyncArgs = {
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
  const { lastSyncedRef } = args;
  lastSyncedRef.current = null;
  const store = getRegisteredClientStore();
  const hadLocal =
    store.getSessionToken() !== null || store.getAccountId() !== null;
  if (hadLocal) {
    await clearLocalAuthMirrors();
  }
}

async function handleHostedSignedIn(args: SyncArgs): Promise<void> {
  const { getSessionToken, lastSyncedRef } = args;
  const token = await getSessionToken();
  if (token === null || token.length === 0) {
    return;
  }

  const store = getRegisteredClientStore();
  const storage = store.getSecureStorage();
  await writeSessionToken(storage, token);
  store.setSessionToken(token);

  if (lastSyncedRef.current === token) {
    return;
  }

  const log = store.getLogger().child({ namespace: 'hosted_auth_bridge' });
  const deviceService = await store.getDeviceService();
  const deviceId = deviceService.getDeviceId();
  const config = store.getConfigService();

  try {
    const { accountId } = await fetchAuthWhoAmI({
      apiUrl: config.getApiUrl(),
      bearerToken: token,
      deviceId,
    });
    store.setAccountId(accountId);
    await writeLastLocalAccountId(storage, accountId);
    const stack = await store.getPatchDbStack();
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
