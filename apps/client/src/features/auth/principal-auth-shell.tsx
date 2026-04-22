import { assert } from '@gamezilla/shared/assert';
import { DependencyInjectionContainer } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import {
  ContainerProvider,
  useContainer,
} from '@gamezilla/shared/dependency-injection/react';
import { useLogger } from '@gamezilla/shared/logger/react';
import { SecureStorageToken } from '@gamezilla/shared/secure-storage/interface';
import { Box, Button, Center, Text } from '@gamezilla/shared/ui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createSecureStorage } from './create-secure-storage';
import {
  createPrincipalService,
  PrincipalServiceToken,
} from './principal-service';

export function PrincipalAuthShell({ children }: { children: ReactNode }) {
  const log = useLogger('auth');
  const parentContainer = useContainer();
  assert.ok(
    parentContainer instanceof DependencyInjectionContainer,
    'PrincipalAuthShell must be inside ConfigContainerProvider'
  );

  const [childContainer, setChildContainer] =
    useState<DependencyInjectionContainer | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const run = useCallback(() => {
    setError(null);
    void (async () => {
      try {
        const storage = createSecureStorage();
        const principalService = await createPrincipalService(storage);
        const child = new DependencyInjectionContainer(parentContainer);
        child.registerValue(SecureStorageToken, storage);
        child.registerValue(PrincipalServiceToken, principalService);
        if (mountedRef.current) {
          setChildContainer(child);
        }
      } catch (err: unknown) {
        log.error('principal init failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();
  }, [log, parentContainer]);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => {
      mountedRef.current = false;
    };
  }, [run]);

  if (error !== null) {
    return (
      <Center sx={{ flex: 1, gap: 4, p: 4, background: 'surface' }}>
        <Text
          variant="bodyBold"
          sx={{ fontSize: 'base' }}
          style={{ textAlign: 'center' }}
          label="Failed to initialize identity"
        />
        <Text
          sx={{ fontSize: 'sm', opacity: 0.8 }}
          style={{ textAlign: 'center' }}
          label={error.message}
        />
        <Box sx={{ mt: 4 }}>
          <Button title="Retry" onPress={run} />
        </Box>
      </Center>
    );
  }

  if (childContainer === null) {
    return null;
  }

  return (
    <ContainerProvider container={childContainer}>{children}</ContainerProvider>
  );
}
