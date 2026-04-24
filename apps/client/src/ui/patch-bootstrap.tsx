import { createGamezillaApiClient } from '@gamezilla/client/features/api/hc';
import { createPatchDbHcTransport } from '@gamezilla/client/features/api/patch-db-hc-transport';
import { ensurePrincipalEntity } from '@gamezilla/client/features/auth/ensure-principal-entity';
import { ensureProfileEntity } from '@gamezilla/client/features/auth/ensure-profile-entity';
import { PrincipalPatchesDb } from '@gamezilla/client/features/auth/principal-patches-db';
import { PrincipalServiceToken } from '@gamezilla/client/features/auth/principal-service';
import {
  createSessionService,
  SessionServiceToken,
} from '@gamezilla/client/features/auth/session-service';
import { OfflineIndicator } from '@gamezilla/client/features/connection/offline-indicator';
import {
  bootstrapPatchDbExpoSync,
  clearLocalDatabaseAndReload,
} from '@gamezilla/patch-db/bootstrap-expo';
import { PatchesDbToken } from '@gamezilla/patch-db/react';
import { assert } from '@gamezilla/lib/assert';
import { ConfigServiceToken } from '@gamezilla/domain/config/config-service';
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
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, View } from 'react-native';

export function PatchBootstrap({ children }: { children: ReactNode }) {
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
        const db = c.get(PatchesDbToken);
        await ensurePrincipalEntity(db, principalId);
        await ensureProfileEntity(db, principalId);
        // `bootstrapPatchDbExpoSync` caches the container on web, so StrictMode
        // double-invokes can land on the same container. Register once; on
        // subsequent runs just refresh the already-registered service.
        if (c.has(SessionServiceToken)) {
          await c.get(SessionServiceToken).refresh();
        } else {
          const sessionService = createSessionService(db, principalService);
          await sessionService.refresh();
          c.registerValue(SessionServiceToken, sessionService);
        }
        if (mountedRef.current) {
          setContainer(c);
        }
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
    if (container !== null || error !== null) {
      void hideSplash();
    }
  }, [container, error]);

  const onClearLocalDataAndReload = useCallback(async () => {
    try {
      setError(null);
      await clearLocalDatabaseAndReload('main');
      if (Platform.OS !== 'web') {
        runBootstrap();
      }
    } catch (err: unknown) {
      log.error('clear local database failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [log, runBootstrap]);

  if (error !== null) {
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
          <Button title="Retry" onPress={runBootstrap} />
          <Button
            title="Clear local data & reload"
            color="destructive"
            onPress={() => void onClearLocalDataAndReload()}
          />
        </Box>
      </Center>
    );
  }

  if (container === null) {
    return null;
  }

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
