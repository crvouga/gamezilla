import { createGamezillaApiClient } from '@gamezilla/client/api/hc';
import { createPatchDbHcTransport } from '@gamezilla/client/api/patch-db-hc-transport';
import {
  AuthAccountIdHolderToken,
  type AuthAccountIdHolder,
} from '@gamezilla/client/auth/auth-account-id-holder';
import {
  AuthSessionTokenHolderToken,
  type AuthSessionTokenHolder,
} from '@gamezilla/client/auth/auth-session-token-holder';
import { ensureDeviceEntity } from '@gamezilla/client/auth/ensure-device-entity';
import {
  ensureAccountProfile,
  ensureDeviceProfile,
} from '@gamezilla/client/auth/ensure-profile-entity';
import {
  DeviceServiceToken,
  type DeviceService,
} from '@gamezilla/client/auth/device-service';
import {
  createSessionService,
  SessionServiceToken,
  type AccountSessionRecord,
} from '@gamezilla/client/auth/session-service';
import {
  closeCurrentAccountDb,
  deleteAccountLocalData,
  deleteAnonymousDatabaseFileBestEffort,
  ensureAccountDatabaseDirectory,
  getCurrentAccountDatabaseBasename,
  getCurrentPatchSqlClient,
  openAccountDb,
  openAnonymousDb,
  registerAccountDatabaseSwitchHooks,
} from '@gamezilla/client/db/account-db';
import {
  readLastLocalAccountId,
  writeLastLocalAccountId,
} from '@gamezilla/client/db/account-local-state';
import { ensureServerClientId } from '@gamezilla/client/db/ensure-server-client-id';
import { assertDeviceId } from '@gamezilla/domain/auth/device-id';
import { ConfigServiceToken } from '@gamezilla/domain/config/config-service';
import { assert } from '@gamezilla/lib/assert';
import { clearWebClientPersistentState } from '@gamezilla/lib/browser/clear-web-client-state';
import {
  DependencyInjectionContainer,
  isComposableDiParent,
  type Container,
} from '@gamezilla/lib/dependency-injection';
import {
  ContainerProvider,
  useContainer,
  useDependency,
} from '@gamezilla/lib/dependency-injection/react';
import { useLogger } from '@gamezilla/lib/logger/react';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { SqlClientImplExpoSqlite } from '@gamezilla/lib/sql-client/impl-expo-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import {
  SecureStorageToken,
  type SecureStorage,
} from '@gamezilla/lib/secure-storage/interface';
import { assertDatabaseName } from '@gamezilla/lib/sqlite';
import { Box, Button, Center, hideSplash, Text } from '@gamezilla/lib/ui';
import { assertUrl } from '@gamezilla/patch-db/assert-url';
import { PatchDbImplClientTransport } from '@gamezilla/patch-db/impl-client-transport';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import { SyncPatchDb } from '@gamezilla/patch-db/impl-sync';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { PatchMetadataStamper } from '@gamezilla/patch-db/metadata/patch-metadata-stamper';
import {
  forceDetachPatchDbQuerySubscriptionsForDb,
  PatchDbSyncPubSubToken,
  PatchDbToken,
  SyncPatchDbToken,
} from '@gamezilla/patch-db/react';
import {
  SubscribablePatchDbToken,
  type SubscribablePatchDbLike,
} from '@gamezilla/patch-db/subscribable';
import {
  PatchDbClientTransportHttpFetch,
  type PatchDbClientTransport,
} from '@gamezilla/patch-db/transport';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import * as SQLite from 'expo-sqlite';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import {
  registerPatchDbLifecycleCallbacks,
  reopenPatchDbAsAnonymous,
} from './patch-db-lifecycle-api';
import {
  getSessionServiceForAuth,
  setPatchRuntimeHandles,
} from './patch-runtime-ref';

/**
 * Web: single default SQLite name (no per-account directory support in expo-sqlite on web).
 * Native: one file per account under {@link ensureAccountDatabaseDirectory}.
 */
type BootstrapResult = {
  container: DependencyInjectionContainer;
};

type BootstrapPatchDbExpoSyncOptions = {
  /** Web only; native supplies {@link sqlClient} from account-db. */
  databaseName?: string;
  /** Absolute URL including patch-db base path, e.g. `https://host/patch-db`. */
  apiUrl: string;
  /** If set, used instead of {@link PatchDbClientTransportHttpFetch}(apiUrl). */
  transport?: PatchDbClientTransport;
  pushIntervalMs?: number;
  pollIntervalMs?: number;
  parentContainer?: Container;
  /**
   * Wrap the sync DB (e.g. stamp every patch with deviceId via `createdBy`).
   * Must preserve {@link SubscribablePatchDbLike.subscribe}.
   */
  decoratePatchDb?: (db: SubscribablePatchDbLike) => SubscribablePatchDbLike;
  /** Native: already opened + migrated via account-db (omit on web). */
  sqlClient?: SqlClient;
};

let cachedBootstrap: { key: string; promise: Promise<BootstrapResult> } | null =
  null;

const USE_ABSURD_SQL_ON_WEB = false;

const DEFAULT_DATABASE_NAME = String('main');

/** Last decorated db + sync for teardown before closing SQLite. */
let activePatchStack: {
  readonly decorated: SubscribablePatchDbLike;
  readonly syncDb: SyncPatchDb;
} | null = null;

function clearActivePatchStack(): void {
  activePatchStack = null;
}

async function teardownActivePatchStack(): Promise<void> {
  const stack = activePatchStack;
  if (stack === null) return;
  forceDetachPatchDbQuerySubscriptionsForDb(stack.decorated);
  stack.syncDb.destroy();
  clearActivePatchStack();
}

async function openLocalSqlClientWeb(databaseName: string): Promise<SqlClient> {
  if (Platform.OS === 'web' && USE_ABSURD_SQL_ON_WEB) {
    const { SqlClientImplAbsurdSql } =
      await import('@gamezilla/lib/sql-client/impl-absurd-sql');
    return await SqlClientImplAbsurdSql.open(databaseName);
  }
  return await SqlClientImplExpoSqlite.open(databaseName);
}

async function bootstrapPatchDbExpoSync(
  options: BootstrapPatchDbExpoSyncOptions
): Promise<BootstrapResult> {
  const {
    databaseName = DEFAULT_DATABASE_NAME,
    apiUrl,
    transport: transportOption,
    pushIntervalMs = 2000,
    pollIntervalMs = 5000,
    parentContainer,
    decoratePatchDb,
    sqlClient: sqlClientOption,
  } = options;

  assertUrl(apiUrl);

  const key =
    Platform.OS === 'web'
      ? `web:${databaseName}:${apiUrl}`
      : `native:${apiUrl}:${sqlClientOption !== undefined ? 'ext' : 'none'}`;

  if (Platform.OS === 'web' && cachedBootstrap?.key === key) {
    return cachedBootstrap.promise;
  }

  const bootstrapPromise = (async (): Promise<BootstrapResult> => {
    let sqlClient: SqlClient;
    if (Platform.OS === 'web') {
      assertDatabaseName(databaseName);
      sqlClient = await openLocalSqlClientWeb(databaseName);
      await sqlClient.connect();
    } else {
      if (sqlClientOption === undefined) {
        throw new Error(
          'bootstrapPatchDbExpoSync: sqlClient required on native'
        );
      }
      sqlClient = sqlClientOption;
    }

    const localDb = new PatchDbImplSqlite(sqlClient);
    await localDb.migrate();

    const transport =
      transportOption ?? new PatchDbClientTransportHttpFetch(apiUrl);
    const remoteDb = new PatchDbImplClientTransport(transport);
    const pubSub = new InMemoryPubSub();
    const syncDb = new SyncPatchDb(localDb, remoteDb, pubSub, {
      pushIntervalMs,
      pollIntervalMs,
    });

    const dbForDi: SubscribablePatchDbLike =
      decoratePatchDb !== undefined ? decoratePatchDb(syncDb) : syncDb;

    const container = new DependencyInjectionContainer(parentContainer);
    container.registerValue(PatchDbToken, dbForDi);
    container.registerValue(SubscribablePatchDbToken, dbForDi);
    container.registerValue(PatchDbSyncPubSubToken, pubSub);
    container.registerValue(SyncPatchDbToken, syncDb);

    activePatchStack = { decorated: dbForDi, syncDb };

    return { container };
  })();

  if (Platform.OS === 'web') {
    cachedBootstrap = { key, promise: bootstrapPromise };
    void bootstrapPromise.catch(() => {
      if (cachedBootstrap?.key === key) {
        cachedBootstrap = null;
      }
    });
  }
  return bootstrapPromise;
}

type NativeBootstrapIdentity =
  | { readonly mode: 'account'; readonly accountId: string }
  | { readonly mode: 'anonymous'; readonly clientId: string };

async function resolveNativeBootstrapIdentity(
  apiBase: string,
  storage: SecureStorage
): Promise<NativeBootstrapIdentity> {
  const last = await readLastLocalAccountId(storage);
  if (last !== null) {
    return { mode: 'account', accountId: last };
  }
  const clientId = await ensureServerClientId(apiBase, storage);
  return { mode: 'anonymous', clientId };
}

/** Tear down sync + React patch-db subscriptions (SQLite may still be open). */
export async function teardownPatchDbStack(): Promise<void> {
  await teardownActivePatchStack();
}

/**
 * Clears session rows on the current DB, deletes this account's SQLite file,
 * clears last-local-account pointer, and reopens the anonymous database.
 */
export async function removeLocalDataForAccount(
  accountId: string,
  storage: SecureStorage
): Promise<void> {
  await getSessionServiceForAuth().clearSession();
  await teardownActivePatchStack();
  await deleteAccountLocalData(accountId);
  await writeLastLocalAccountId(storage, null);
  await reopenPatchDbAsAnonymous();
}

export async function clearLocalDatabaseAndReload(): Promise<void> {
  cachedBootstrap = null;
  await teardownActivePatchStack();
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      await clearWebClientPersistentState();
      window.location.reload();
    }
    return;
  }
  const name = getCurrentAccountDatabaseBasename();
  await closeCurrentAccountDb();
  if (name !== null) {
    const dir = await ensureAccountDatabaseDirectory();
    if (dir !== undefined && dir.length > 0) {
      await SQLite.deleteDatabaseAsync(name, dir);
    } else {
      await SQLite.deleteDatabaseAsync(name);
    }
  }
}

async function applySessionToHolders(args: {
  readonly db: PatchDb;
  readonly session: AccountSessionRecord | null;
  readonly accountIdHolder: { set: (id: string | null) => void };
  readonly sessionTokenHolder: { set: (token: string | null) => void };
}): Promise<void> {
  const { db, session, accountIdHolder, sessionTokenHolder } = args;
  accountIdHolder.set(session?.accountId ?? null);
  sessionTokenHolder.set(session?.token ?? null);
  if (session !== null) {
    await ensureAccountProfile(db, session.accountId);
  }
}

async function registerSessionService(
  c: DependencyInjectionContainer,
  deviceService: DeviceService,
  accountIdHolder: {
    get: () => string | null;
    set: (id: string | null) => void;
  },
  sessionTokenHolder: {
    get: () => string | null;
    set: (token: string | null) => void;
  }
) {
  const db = c.get(PatchDbToken);
  const deviceId = deviceService.getDeviceId();
  await ensureDeviceEntity(db, deviceId);
  await ensureDeviceProfile(db, deviceId);
  const sessionService = c.has(SessionServiceToken)
    ? c.get(SessionServiceToken)
    : createSessionService(db, deviceService);
  await sessionService.refresh();
  await applySessionToHolders({
    db,
    session: sessionService.getSession(),
    accountIdHolder,
    sessionTokenHolder,
  });
  if (!c.has(SessionServiceToken)) {
    c.registerValue(SessionServiceToken, sessionService);
  }
}

function ErrorView({
  error,
  onRetry,
  onClear,
}: {
  error: Error;
  onRetry: () => void;
  onClear: () => Promise<void>;
}) {
  return (
    <Center sx={{ flex: 1, gap: 4, p: 4, background: 'surface' }}>
      <Text
        variant="bodyBold"
        sx={{ fontSize: 'base' }}
        style={{ textAlign: 'center' }}
        label={<Trans>Failed to initialize</Trans>}
      />
      <Text
        sx={{ fontSize: 'sm', opacity: 0.8 }}
        style={{ textAlign: 'center' }}
        label={error.message}
      />
      <Box sx={{ mt: 4, gap: 3, alignItems: 'center' }}>
        <Button title={t`Retry`} onPress={onRetry} />
        <Button
          title={t`Clear local data & reload`}
          color="destructive"
          onPress={() => void onClear()}
        />
      </Box>
    </Center>
  );
}

function BootstrappedShell({
  container,
  children,
}: {
  container: Container;
  children: ReactNode;
}) {
  return (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
}

type PatchBootstrapDeps = {
  readonly apiBase: string;
  readonly parentContainer: Container;
  readonly deviceService: DeviceService;
  readonly accountIdHolder: AuthAccountIdHolder;
  readonly sessionTokenHolder: AuthSessionTokenHolder;
  readonly secureStorage: SecureStorage;
};

async function performPatchInfrastructureOnly(
  deps: PatchBootstrapDeps,
  sqlClient: SqlClient | null
): Promise<DependencyInjectionContainer> {
  const {
    apiBase,
    parentContainer,
    deviceService,
    accountIdHolder,
    sessionTokenHolder,
  } = deps;
  let stamper: PatchMetadataStamper | null = null;
  const transport = createPatchDbHcTransport(
    createGamezillaApiClient(apiBase),
    {
      patchDbBaseUrl: String(`${apiBase}/patch-db`),
      getAuthToken: () => sessionTokenHolder.get(),
    }
  );
  const decoratePatchDb = (db: SubscribablePatchDbLike) => {
    stamper = new PatchMetadataStamper(db, {
      getDeviceId: () => deviceService.getDeviceId(),
      getAccountId: () => accountIdHolder.get(),
      assertDeviceId: (id) => assertDeviceId(id),
    });
    return stamper;
  };
  const syncOpts =
    Platform.OS === 'web'
      ? {
          apiUrl: String(`${apiBase}/patch-db`),
          transport,
          parentContainer,
          decoratePatchDb,
        }
      : {
          apiUrl: String(`${apiBase}/patch-db`),
          transport,
          parentContainer,
          decoratePatchDb,
          sqlClient:
            sqlClient ??
            (() => {
              throw new Error(
                'performPatchInfrastructureOnly: sqlClient required on native'
              );
            })(),
        };
  const { container: c } = await bootstrapPatchDbExpoSync(syncOpts);
  assert.ok(
    c instanceof DependencyInjectionContainer,
    'bootstrap must return DependencyInjectionContainer'
  );
  const metadataStamper = stamper as PatchMetadataStamper | null;
  if (metadataStamper !== null) {
    await metadataStamper.backfillCreatedBy();
  }
  await registerSessionService(
    c,
    deviceService,
    accountIdHolder,
    sessionTokenHolder
  );
  if (metadataStamper !== null) {
    await metadataStamper.clearRejectedPushes();
  }
  return c;
}

async function performPatchBootstrap(
  deps: PatchBootstrapDeps
): Promise<DependencyInjectionContainer> {
  const { apiBase, secureStorage } = deps;

  if (Platform.OS === 'web') {
    return performPatchInfrastructureOnly(deps, null);
  }

  await ensureAccountDatabaseDirectory();
  const identity = await resolveNativeBootstrapIdentity(apiBase, secureStorage);

  if (identity.mode === 'account') {
    await openAccountDb(identity.accountId);
  } else {
    await openAnonymousDb(identity.clientId);
  }

  const sql = getCurrentPatchSqlClient();
  let c = await performPatchInfrastructureOnly(deps, sql);

  const sessionService = c.get(SessionServiceToken);
  if (identity.mode === 'account' && sessionService.getSession() === null) {
    await writeLastLocalAccountId(secureStorage, null);
    await teardownActivePatchStack();
    setPatchRuntimeHandles(null);
    await closeCurrentAccountDb();
    const clientId = await ensureServerClientId(apiBase, secureStorage);
    await openAnonymousDb(clientId);
    const sql2 = getCurrentPatchSqlClient();
    c = await performPatchInfrastructureOnly(deps, sql2);
  }

  return c;
}

function usePatchBootstrap() {
  const log = useLogger('patch-bootstrap');
  const [container, setContainer] = useState<Container | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [nativeIdentityKey, setNativeIdentityKey] = useState<string>('');
  const rawContainer = useContainer();
  assert.ok(
    isComposableDiParent(rawContainer),
    'PatchBootstrap must be rendered inside ConfigContainerProvider (and DeviceAuthShell for device identity)'
  );
  const parentContainer = rawContainer;
  const configService = useDependency(ConfigServiceToken);
  const deviceService = useDependency(DeviceServiceToken);
  const accountIdHolder = useDependency(AuthAccountIdHolderToken);
  const sessionTokenHolder = useDependency(AuthSessionTokenHolderToken);
  const secureStorage = useDependency(SecureStorageToken);
  const mountedRef = useRef(true);
  const depsRef = useRef<PatchBootstrapDeps | null>(null);
  depsRef.current = {
    apiBase: configService.getApiUrl(),
    parentContainer,
    deviceService,
    accountIdHolder,
    sessionTokenHolder,
    secureStorage,
  };

  const wireRuntime = useCallback((c: Container) => {
    setPatchRuntimeHandles({
      getPatchDb: () => c.get(PatchDbToken),
      getSessionService: () => c.get(SessionServiceToken),
    });
  }, []);

  const runBootstrap = useCallback(() => {
    setError(null);
    const deps = depsRef.current;
    if (deps === null) return;
    performPatchBootstrap(deps)
      .then((c) => {
        wireRuntime(c);
        if (mountedRef.current) setContainer(c);
      })
      .catch((err: unknown) => {
        log.error('bootstrap failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });
  }, [log, wireRuntime]);

  useEffect(() => {
    mountedRef.current = true;
    if (Platform.OS === 'web') {
      setNativeIdentityKey('web');
      return;
    }
    let cancelled = false;
    void (async () => {
      const d = depsRef.current;
      if (d === null) return;
      try {
        const id = await resolveNativeBootstrapIdentity(
          d.apiBase,
          d.secureStorage
        );
        const key =
          id.mode === 'account' ? `a:${id.accountId}` : `n:${id.clientId}`;
        if (!cancelled) setNativeIdentityKey(key);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configService, secureStorage]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      runBootstrap();
      return;
    }
    if (nativeIdentityKey.length === 0) return;
    runBootstrap();
  }, [nativeIdentityKey, runBootstrap]);

  useEffect(() => {
    registerAccountDatabaseSwitchHooks({
      beforeClose: async () => {
        await teardownActivePatchStack();
      },
      afterOpen: async () => {},
    });
    return () => {
      registerAccountDatabaseSwitchHooks(null);
    };
  }, []);

  useEffect(() => {
    registerPatchDbLifecycleCallbacks({
      reopenAsAccount: async (accountId: string) => {
        const deps = depsRef.current;
        if (deps === null) throw new Error('patch bootstrap deps missing');
        await teardownActivePatchStack();
        await closeCurrentAccountDb();
        await writeLastLocalAccountId(deps.secureStorage, accountId);
        await openAccountDb(accountId);
        const sql = getCurrentPatchSqlClient();
        const c = await performPatchInfrastructureOnly(deps, sql);
        wireRuntime(c);
        const clientId = await ensureServerClientId(
          deps.apiBase,
          deps.secureStorage
        );
        await deleteAnonymousDatabaseFileBestEffort(clientId);
        if (mountedRef.current) {
          setContainer(c);
          setNativeIdentityKey(`a:${accountId}`);
        }
      },
      reopenAsAnonymous: async () => {
        const deps = depsRef.current;
        if (deps === null) throw new Error('patch bootstrap deps missing');
        await teardownActivePatchStack();
        await closeCurrentAccountDb();
        await writeLastLocalAccountId(deps.secureStorage, null);
        const clientId = await ensureServerClientId(
          deps.apiBase,
          deps.secureStorage
        );
        await openAnonymousDb(clientId);
        const sql = getCurrentPatchSqlClient();
        const c = await performPatchInfrastructureOnly(deps, sql);
        wireRuntime(c);
        if (mountedRef.current) {
          setContainer(c);
          setNativeIdentityKey(`n:${clientId}`);
        }
      },
    });
    return () => {
      registerPatchDbLifecycleCallbacks(null);
      setPatchRuntimeHandles(null);
    };
  }, [wireRuntime]);

  useEffect(() => {
    if (container !== null || error !== null) void hideSplash();
  }, [container, error]);

  const onClearLocalDataAndReload = useCallback(async () => {
    try {
      setError(null);
      await clearLocalDatabaseAndReload();
      if (Platform.OS !== 'web') runBootstrap();
    } catch (err: unknown) {
      log.error('clear local database failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [log, runBootstrap]);

  return { container, error, runBootstrap, onClearLocalDataAndReload };
}

export function PatchBootstrap({ children }: { children: ReactNode }) {
  const { container, error, runBootstrap, onClearLocalDataAndReload } =
    usePatchBootstrap();

  if (error !== null) {
    return (
      <ErrorView
        error={error}
        onRetry={runBootstrap}
        onClear={onClearLocalDataAndReload}
      />
    );
  }
  if (container === null) return null;
  return (
    <BootstrappedShell container={container}>{children}</BootstrappedShell>
  );
}
