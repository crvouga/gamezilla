import { assert } from '@gamezilla/shared/assert';
import { ConfigServiceToken } from '@gamezilla/shared/config/config-service';
import type { Container } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import { DependencyInjectionContainer } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import {
  ContainerProvider,
  useContainer,
  useDependency,
} from '@gamezilla/shared/dependency-injection/react';
import { Box, Text, Button, Center, hideSplash } from '@gamezilla/shared/ui';
import { bootstrapPatchDbExpoSync } from '@gamezilla/patch-db/bootstrap-expo';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export function PatchBootstrap({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<Container | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const rawContainer = useContainer();
  assert.ok(
    rawContainer instanceof DependencyInjectionContainer,
    'PatchBootstrap must be rendered inside ConfigContainerProvider'
  );
  const configContainer = rawContainer;
  const configService = useDependency(ConfigServiceToken);

  const mountedRef = useRef(true);

  const runBootstrap = useCallback(() => {
    setError(null);
    bootstrapPatchDbExpoSync({
      apiUrl: `${configService.getApiUrl()}/patch-db`,
      parentContainer: configContainer,
    })
      .then(({ container: c }) => {
        if (mountedRef.current) setContainer(c);
      })
      .catch((err: unknown) => {
        console.error('[PatchBootstrap] Bootstrap failed:', err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });
  }, [configService, configContainer]);

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

  if (error !== null) {
    return (
      <Center sx={{ flex: 1, gap: 4, p: 4 }}>
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
        <Box sx={{ mt: 4 }}>
          <Button title="Retry" onPress={runBootstrap} />
        </Box>
      </Center>
    );
  }

  if (container === null) {
    return null;
  }

  return (
    <ContainerProvider container={container}>{children}</ContainerProvider>
  );
}
