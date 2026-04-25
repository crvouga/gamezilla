import { createGamezillaApiClient } from '@gamezilla/client/api/hc';
import { createPatchDbHcTransport } from '@gamezilla/client/api/patch-db-hc-transport';
import { ensurePrincipalEntity } from '@gamezilla/client/auth/ensure-principal-entity';
import { ensureProfileEntity } from '@gamezilla/client/auth/ensure-profile-entity';
import { PrincipalPatchesDb } from '@gamezilla/client/auth/principal-patches-db';
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
import type { Container } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import { DependencyInjectionContainer } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import {
  ContainerProvider,
  useContainer,
  useDependency,
} from '@gamezilla/lib/dependency-injection/react';
import { useLogger } from '@gamezilla/lib/logger/react';
import { Box, Button, Center, hideSplash, Text } from '@gamezilla/lib/ui';
import {
  bootstrapPatchDbExpoSync,
  clearLocalDatabaseAndReload,
} from '@gamezilla/patch-db/bootstrap-expo';
import { PatchesDbToken } from '@gamezilla/patch-db/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, View } from 'react-native';

async function registerSessionService(
  c: DependencyInjectionContainer,
  principalService: PrincipalService
) {
  const db = c.get(PatchesDbToken);
  const principalId = principalService.getPrincipalId();
  await ensurePrincipalEntity(db, principalId);
  await ensureProfileEntity(db, principalId);
  if (c.has(SessionServiceToken)) {
    await c.get(SessionServiceToken).refresh();
    return;
  }
  const sessionService = createSessionService(db, principalService);
  await sessionService.refresh();
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
        label="Failed to initialize"
      />
      <Text
        sx={{ fontSize: 'sm', opacity: 0.8 }}
        style={{ textAlign: 'center' }}
        label={error.message}
      />
      <Box sx={{ mt: 4, gap: 3, alignItems: 'center' }}>
        <Button title="Retry" onPress={onRetry} />
        <Button
          title="Clear local data & reload"
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

  const mountedRef = useRef(true);

  const runBootstrap = useCallback(() => {
    setError(null);
    const principalId = principalService.getPrincipalId();
    const apiBase = configService.getApiUrl();
    void bootstrapPatchDbExpoSync({
      apiUrl: `${apiBase}/patch-db`,
      transport: createPatchDbHcTransport(createGamezillaApiClient(apiBase)),
      parentContainer,
      decoratePatchesDb: (db) => new PrincipalPatchesDb(db, principalId),
    })
      .then(async ({ container: c }) => {
        assert.ok(
          c instanceof DependencyInjectionContainer,
          'bootstrap must return DependencyInjectionContainer'
        );
        await registerSessionService(c, principalService);
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
  }, [configService, log, parentContainer, principalService]);

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
  return <BootstrappedShell container={container}>{children}</BootstrappedShell>;
}
