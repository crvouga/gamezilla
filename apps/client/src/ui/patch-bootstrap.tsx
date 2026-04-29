import { createGamezillaApiClient } from '@gamezilla/client/api/hc';
import { createPatchDbHcTransport } from '@gamezilla/client/api/patch-db-hc-transport';
import { ensurePrincipalEntity } from '@gamezilla/client/auth/ensure-principal-entity';
import { AuthAccountIdHolderToken } from '@gamezilla/client/auth/auth-account-id-holder';
import {
  ensureAccountProfile,
  ensurePrincipalProfile,
} from '@gamezilla/client/auth/ensure-profile-entity';
import { LastModifiedByPatchesDb } from '@gamezilla/client/auth/last-modified-by-patches-db';
import {
  PrincipalServiceToken,
  type PrincipalService,
} from '@gamezilla/client/auth/principal-service';
import {
  createSessionService,
  SessionServiceToken,
} from '@gamezilla/client/auth/session-service';
import { OfflineIndicator } from '@gamezilla/client/connection/offline-indicator';
import { ConfigServiceToken } from '@gamezilla/domain/config/config-service';
import { assert } from '@gamezilla/lib/assert';
import { clearWebClientPersistentState } from '@gamezilla/lib/browser/clear-web-client-state';
import type { Container } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import { DependencyInjectionContainer } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import {
  ContainerProvider,
  useContainer,
  useDependency,
} from '@gamezilla/lib/dependency-injection/react';
import { useLogger } from '@gamezilla/lib/logger/react';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { SqlClientImplExpoSqlite } from '@gamezilla/lib/sql-client/impl-expo-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { assertDatabaseName } from '@gamezilla/lib/sqlite';
import { Box, Button, Center, hideSplash, Text } from '@gamezilla/lib/ui';
import { t } from '@lingui/core/macro';
import { Trans } from '@gamezilla/lib/i18n';
import { assertUrl } from '@gamezilla/patch-db/assert-url';
import { PatchDbImplClientTransport } from '@gamezilla/patch-db/impl-client-transport';
import { PatchDbImplSqlite } from '@gamezilla/patch-db/impl-sqlite/impl-sqlite';
import { SyncPatchesDb } from '@gamezilla/patch-db/impl-sync';
import {
  PatchDbSyncPubSubToken,
  PatchesDbToken,
} from '@gamezilla/patch-db/react';
import {
  SubscribablePatchesDbToken,
  type SubscribablePatchesDbLike,
} from '@gamezilla/patch-db/subscribable';
import {
  PatchDbClientTransportHttpFetch,
  type PatchDbClientTransport,
} from '@gamezilla/patch-db/transport';
import * as SQLite from 'expo-sqlite';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, View } from 'react-native';

/**
 * Web uses sql.js + absurd-sql (IndexedDB-backed SQLite) in a worker for a
 * local-first, offline-capable store. Native uses persistent expo-sqlite.
 *
 * We avoid expo-sqlite on web: its `AccessHandlePoolVFS` grabs an exclusive
 * `FileSystemSyncAccessHandle` on OPFS pool files at worker init, so a second
 * tab fails with `NoModificationAllowedError`. absurd-sql uses IndexedDB
 * instead.
 */
type BootstrapResult = {
  container: DependencyInjectionContainer;
};

type BootstrapPatchDbExpoSyncOptions = {
  databaseName?: string;
  /** Absolute URL including patch-db base path, e.g. `https://host/patch-db`. */
  apiUrl: string;
  /** If set, used instead of {@link PatchDbClientTransportHttpFetch}(apiUrl). */
  transport?: PatchDbClientTransport;
  pushIntervalMs?: number;
  pollIntervalMs?: number;
  parentContainer?: DependencyInjectionContainer;
  /**
   * Wrap the sync DB (e.g. stamp every patch with principalId via `createdBy`).
   * Must preserve {@link SubscribablePatchesDbLike.subscribe}.
   */
  decoratePatchesDb?: (
    db: SubscribablePatchesDbLike
  ) => SubscribablePatchesDbLike;
};

let cachedBootstrap: { key: string; promise: Promise<BootstrapResult> } | null =
  null;
let currentSqlClient: SqlClient | null = null;

const USE_ABSURD_SQL_ON_WEB = false;

async function openLocalSqlClient(databaseName: string): Promise<SqlClient> {
  if (Platform.OS === 'web' && USE_ABSURD_SQL_ON_WEB) {
    const { SqlClientImplAbsurdSql } =
      await import('@gamezilla/lib/sql-client/impl-absurd-sql');
    return await SqlClientImplAbsurdSql.open(databaseName);
  }
  return await SqlClientImplExpoSqlite.open(databaseName);
}

const DEFAULT_DATABASE_NAME = String('main');

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
    decoratePatchesDb,
  } = options;

  assertDatabaseName(databaseName);
  assertUrl(apiUrl);

  const key = `${databaseName}:${apiUrl}`;
  if (Platform.OS === 'web' && cachedBootstrap?.key === key) {
    return cachedBootstrap.promise;
  }

  const bootstrapPromise = (async (): Promise<BootstrapResult> => {
    const sqlClient = await openLocalSqlClient(databaseName);
    currentSqlClient = sqlClient;
    await sqlClient.connect();

    const localDb = new PatchDbImplSqlite(sqlClient);
    await localDb.migrate();

    const transport =
      transportOption ?? new PatchDbClientTransportHttpFetch(apiUrl);
    const remoteDb = new PatchDbImplClientTransport(transport);
    const pubSub = new InMemoryPubSub();
    const syncDb = new SyncPatchesDb(localDb, remoteDb, pubSub, {
      pushIntervalMs,
      pollIntervalMs,
    });

    const dbForDi: SubscribablePatchesDbLike =
      decoratePatchesDb !== undefined ? decoratePatchesDb(syncDb) : syncDb;

    const container = new DependencyInjectionContainer(parentContainer);
    container.registerValue(PatchesDbToken, dbForDi);
    container.registerValue(SubscribablePatchesDbToken, dbForDi);
    container.registerValue(PatchDbSyncPubSubToken, pubSub);

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

export async function clearLocalDatabaseAndReload(
  databaseName = DEFAULT_DATABASE_NAME
): Promise<void> {
  cachedBootstrap = null;
  if (currentSqlClient) {
    await currentSqlClient.disconnect();
    currentSqlClient = null;
  }
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      await clearWebClientPersistentState();
      window.location.reload();
    }
    return;
  }
  await SQLite.deleteDatabaseAsync(databaseName);
}

async function registerSessionService(
  c: DependencyInjectionContainer,
  principalService: PrincipalService,
  accountIdHolder: {
    get: () => string | null;
    set: (id: string | null) => void;
  }
) {
  const db = c.get(PatchesDbToken);
  const principalId = principalService.getPrincipalId();
  await ensurePrincipalEntity(db, principalId);
  await ensurePrincipalProfile(db, principalId);
  if (c.has(SessionServiceToken)) {
    await c.get(SessionServiceToken).refresh();
    const session = c.get(SessionServiceToken).getSession();
    accountIdHolder.set(session?.accountId ?? null);
    if (session !== null) {
      await ensureAccountProfile(db, session.accountId);
    }
    return;
  }
  const sessionService = createSessionService(db, principalService);
  await sessionService.refresh();
  const session = sessionService.getSession();
  accountIdHolder.set(session?.accountId ?? null);
  if (session !== null) {
    await ensureAccountProfile(db, session.accountId);
  }
  c.registerValue(SessionServiceToken, sessionService);
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
    <ContainerProvider container={container}>
      {Platform.OS === 'web' ? (
        <View
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 10000,
            pointerEvents: 'box-none',
          }}
        >
          <OfflineIndicator />
        </View>
      ) : null}
      {children}
    </ContainerProvider>
  );
}

function usePatchBootstrap() {
  const log = useLogger('patch-bootstrap');
  const [container, setContainer] = useState<Container | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const rawContainer = useContainer();
  assert.ok(
    rawContainer instanceof DependencyInjectionContainer,
    'PatchBootstrap must be rendered inside ConfigContainerProvider (and PrincipalAuthShell for principal)'
  );
  const parentContainer = rawContainer;
  const configService = useDependency(ConfigServiceToken);
  const principalService = useDependency(PrincipalServiceToken);
  const accountIdHolder = useDependency(AuthAccountIdHolderToken);

  const mountedRef = useRef(true);

  const runBootstrap = useCallback(() => {
    setError(null);
    const apiBase = configService.getApiUrl();
    const patchDbUrl = String(`${apiBase}/patch-db`);
    void bootstrapPatchDbExpoSync({
      apiUrl: patchDbUrl,
      transport: createPatchDbHcTransport(createGamezillaApiClient(apiBase)),
      parentContainer,
      decoratePatchesDb: (db) =>
        new LastModifiedByPatchesDb(db, {
          getPrincipalId: () => principalService.getPrincipalId(),
          getAccountId: () => accountIdHolder.get(),
        }),
    })
      .then(async ({ container: c }) => {
        assert.ok(
          c instanceof DependencyInjectionContainer,
          'bootstrap must return DependencyInjectionContainer'
        );
        await registerSessionService(c, principalService, accountIdHolder);
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
  }, [accountIdHolder, configService, log, parentContainer, principalService]);

  useEffect(() => {
    mountedRef.current = true;
    runBootstrap();
    return () => {
      mountedRef.current = false;
    };
  }, [runBootstrap]);

  useEffect(() => {
    if (container !== null || error !== null) void hideSplash();
  }, [container, error]);

  const onClearLocalDataAndReload = useCallback(async () => {
    try {
      setError(null);
      await clearLocalDatabaseAndReload('main');
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
