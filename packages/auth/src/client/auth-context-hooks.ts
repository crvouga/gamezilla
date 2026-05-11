import type { Logger } from '@gamezilla/lib/logger/logger';
import { useRootLogger } from '@gamezilla/lib/logger/react';
import { useSecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SyncPatchDb } from '@gamezilla/patch-db/impl-sync/impl-sync';
import { usePatchDb, useSync } from '@gamezilla/patch-db/react';
import type { createAuthClient } from 'better-auth/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ACCOUNT_SESSION_ENTITY_TYPE, AccountSessionAttr } from '../shared';
import { useAccountIdModel, type AccountIdModel } from './account-id-context';
import { deriveStateFromSession, type SessionDerivedState } from './auth-atoms';
import {
  runHostedSessionSync,
  type HostedSessionSyncRuntime,
} from './better-auth-run-hosted-session-sync';
import { useConfigService } from './config-service-context';
import { useDeviceService } from './device-service-context';
import type { EnsureProfileFn } from './finalize-local-sign-in';
import { clearLocalAuthMirrors } from './local-auth-cleanup';
import type { SessionService } from './session-service';
import { useSessionService } from './session-service-context';
import {
  useSessionTokenModel,
  type SessionTokenModel,
} from './session-token-context';

export type AuthClient = ReturnType<typeof createAuthClient>;
export type SessionSnapshot = ReturnType<AuthClient['useSession']>;

const emptyDerived: SessionDerivedState = {
  deviceId: '',
  session: null,
  accountId: null,
  isAuthenticated: false,
  myId: '',
};

export function useHostedSyncRuntime(): HostedSessionSyncRuntime {
  const secure = useSecureStorage();
  const sessionToken = useSessionTokenModel();
  const accountIdModel = useAccountIdModel();
  const loggerRoot = useRootLogger();
  const deviceService = useDeviceService();
  const config = useConfigService();
  const db = usePatchDb();
  const sync = useSync();
  const sessionService = useSessionService();

  return useMemo<HostedSessionSyncRuntime>(
    () => ({
      secure,
      sessionToken,
      accountId: accountIdModel,
      loggerRoot,
      getDeviceService: () => deviceService,
      getConfigService: () => config,
      getSessionService: () => sessionService,
      getDb: () => db,
      getSync: () => sync,
    }),
    [
      secure,
      sessionToken,
      accountIdModel,
      loggerRoot,
      deviceService,
      config,
      sessionService,
      db,
      sync,
    ]
  );
}

export function useHostedSessionSyncEffect(args: {
  authClient: AuthClient;
  snapshot: SessionSnapshot;
  ensureProfile: EnsureProfileFn;
  syncRuntime: HostedSessionSyncRuntime;
}): void {
  const { authClient, snapshot, ensureProfile, syncRuntime } = args;
  const lastSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    const isLoaded = !snapshot.isPending;
    const computedSignedIn =
      isLoaded &&
      (snapshot.error === null || snapshot.error === undefined) &&
      snapshot.data !== null &&
      snapshot.data !== undefined;
    void runHostedSessionSync({
      isLoaded,
      isSignedIn: computedSignedIn,
      getSessionToken: async () => {
        const r = await authClient.getSession();
        if (r.error !== null && r.error !== undefined) return null;
        if (r.data === null || r.data === undefined) return null;
        const record = r.data as { session?: { token?: string } };
        const tok = record.session?.token;
        return typeof tok === 'string' && tok.length > 0 ? tok : null;
      },
      lastSyncedRef,
      ensureProfile,
      runtime: syncRuntime,
    });
  }, [
    authClient,
    snapshot.data,
    snapshot.error,
    snapshot.isPending,
    ensureProfile,
    syncRuntime,
  ]);
}

export function useDerivedSessionState(): {
  derived: SessionDerivedState;
  pushDerived: () => Promise<void>;
} {
  const sessionService = useSessionService();
  const sessionToken = useSessionTokenModel();
  const accountIdModel = useAccountIdModel();
  const deviceService = useDeviceService();
  const db = usePatchDb();
  const deviceId = deviceService.getDeviceId();

  const [derived, setDerived] = useState<SessionDerivedState>(emptyDerived);

  const pushDerived = useCallback(async () => {
    try {
      await sessionService.refresh();
      setDerived(
        deriveStateFromSession({
          deviceId,
          sessionService,
          sessionToken: sessionToken.getSessionToken(),
          accountIdFromStore: accountIdModel.getAccountId(),
        })
      );
    } catch {
      // Stale `sessionService.refresh` after stack replacement.
    }
  }, [deviceId, sessionService, sessionToken, accountIdModel]);

  useEffect(() => {
    const u1 = sessionToken.subscribe(() => {
      void pushDerived();
    });
    const u2 = accountIdModel.subscribe(() => {
      void pushDerived();
    });
    return () => {
      u1();
      u2();
    };
  }, [sessionToken, accountIdModel, pushDerived]);

  useEffect(() => {
    void pushDerived();
  }, [pushDerived, db]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    void (async () => {
      try {
        await pushDerived();
        if (cancelled) return;
        unsub = db.subscribe.entities(
          {
            entityType: ACCOUNT_SESSION_ENTITY_TYPE,
            where: {
              type: '=',
              attribute: AccountSessionAttr.deviceId.key,
              value: deviceId,
            },
          },
          () => {
            void pushDerived();
          }
        );
      } catch {
        // Stale derivation transients.
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [db, deviceId, pushDerived]);

  return { derived, pushDerived };
}

type SignOutDeps = {
  authClient: AuthClient;
  loggerRoot: Logger;
  secure: SecureStorage;
  sessionToken: SessionTokenModel;
  accountIdModel: AccountIdModel;
  sessionService: SessionService;
  sync: SyncPatchDb;
  refreshSession: () => Promise<void>;
};

export function useSignOutAction(deps: SignOutDeps): () => Promise<void> {
  const {
    authClient,
    loggerRoot,
    secure,
    sessionToken,
    accountIdModel,
    sessionService,
    sync,
    refreshSession,
  } = deps;
  return useCallback(async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      loggerRoot.warn('Hosted sign-out failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      await clearLocalAuthMirrors({
        logger: loggerRoot,
        secure,
        sessionToken,
        accountId: accountIdModel,
        getSessionService: () => sessionService,
        getSync: () => sync,
      });
      await refreshSession();
    }
  }, [
    authClient,
    loggerRoot,
    secure,
    sessionToken,
    accountIdModel,
    sessionService,
    sync,
    refreshSession,
  ]);
}

export function useSignOut(
  authClient: AuthClient,
  syncRuntime: HostedSessionSyncRuntime,
  refreshSession: () => Promise<void>
): () => Promise<void> {
  const sync = useSync();
  return useSignOutAction({
    authClient,
    loggerRoot: syncRuntime.loggerRoot,
    secure: syncRuntime.secure,
    sessionToken: syncRuntime.sessionToken,
    accountIdModel: syncRuntime.accountId,
    sessionService: syncRuntime.getSessionService(),
    sync,
    refreshSession,
  });
}
