import { assert } from '@gamezilla/lib/assert';
import { DependencyInjectionContainer } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import {
  ContainerProvider,
  useContainer,
} from '@gamezilla/lib/dependency-injection/react';
import { useLogger } from '@gamezilla/lib/logger/react';
import { SecureStorageToken } from '@gamezilla/lib/secure-storage/interface';
import { Box, Button, Center, Text } from '@gamezilla/lib/ui';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AuthAccountIdHolder,
  AuthAccountIdHolderToken,
} from './auth-account-id-holder';
import {
  AuthSessionTokenHolder,
  AuthSessionTokenHolderToken,
} from './auth-session-token-holder';
import { createSecureStorage } from './create-secure-storage';
import {
  createPrincipalService,
  PrincipalServiceToken,
} from './principal-service';

async function createPrincipalChildContainer(
  parentContainer: DependencyInjectionContainer
): Promise<DependencyInjectionContainer> {
  const storage = createSecureStorage();
  const principalService = await createPrincipalService(storage);
  const child = new DependencyInjectionContainer(parentContainer);
  child.registerValue(SecureStorageToken, storage);
  child.registerValue(PrincipalServiceToken, principalService);
  child.registerValue(AuthAccountIdHolderToken, new AuthAccountIdHolder());
  child.registerValue(
    AuthSessionTokenHolderToken,
    new AuthSessionTokenHolder()
  );
  return child;
}

function PrincipalErrorView({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <Center sx={{ flex: 1, gap: 4, p: 4, background: 'surface' }}>
      <Text
        variant="bodyBold"
        sx={{ fontSize: 'base' }}
        style={{ textAlign: 'center' }}
        label={<Trans>Failed to initialize identity</Trans>}
      />
      <Text
        sx={{ fontSize: 'sm', opacity: 0.8 }}
        style={{ textAlign: 'center' }}
        label={error.message}
      />
      <Box sx={{ mt: 4 }}>
        <Button title={t`Retry`} onPress={onRetry} />
      </Box>
    </Center>
  );
}

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
    createPrincipalChildContainer(parentContainer)
      .then((child) => {
        if (mountedRef.current) setChildContainer(child);
      })
      .catch((err: unknown) => {
        log.error('principal init failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });
  }, [log, parentContainer]);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => {
      mountedRef.current = false;
    };
  }, [run]);

  if (error !== null) {
    return <PrincipalErrorView error={error} onRetry={run} />;
  }
  if (childContainer === null) {
    return null;
  }
  return (
    <ContainerProvider container={childContainer}>{children}</ContainerProvider>
  );
}
