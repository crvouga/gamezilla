import { assert } from '@gamezilla/lib/assert';
import {
  ComponentSystemBuilder,
  isComposableDiParent,
  type StartedComponentSystem,
} from '@gamezilla/lib/dependency-injection';
import type { Container } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
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
import { createDeviceService, DeviceServiceToken } from './device-service';

async function createAuthDeviceChildContainer(
  parentContainer: Container
): Promise<StartedComponentSystem> {
  const storage = createSecureStorage();
  const deviceService = await createDeviceService(storage);
  const builder = new ComponentSystemBuilder(parentContainer);
  builder.registerValue(SecureStorageToken, storage);
  builder.registerValue(DeviceServiceToken, deviceService);
  builder.registerValue(AuthAccountIdHolderToken, new AuthAccountIdHolder());
  builder.registerValue(
    AuthSessionTokenHolderToken,
    new AuthSessionTokenHolder()
  );
  return await builder.start();
}

function DeviceIdentityErrorView({
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

export function DeviceAuthShell({ children }: { children: ReactNode }) {
  const log = useLogger('auth');
  const parentContainer = useContainer();
  assert.ok(
    isComposableDiParent(parentContainer),
    'DeviceAuthShell must be inside ConfigContainerProvider'
  );

  const [childContainer, setChildContainer] =
    useState<StartedComponentSystem | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const childRef = useRef<StartedComponentSystem | null>(null);

  const run = useCallback(() => {
    setError(null);
    void (async () => {
      try {
        await childRef.current?.stop();
        childRef.current = null;
        if (mountedRef.current) setChildContainer(null);
        const child = await createAuthDeviceChildContainer(parentContainer);
        childRef.current = child;
        if (mountedRef.current) setChildContainer(child);
      } catch (err: unknown) {
        log.error('auth device init failed', {
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
      void childRef.current?.stop();
      childRef.current = null;
    };
  }, [run]);

  if (error !== null) {
    return <DeviceIdentityErrorView error={error} onRetry={run} />;
  }
  if (childContainer === null) {
    return null;
  }
  return (
    <ContainerProvider container={childContainer}>{children}</ContainerProvider>
  );
}
