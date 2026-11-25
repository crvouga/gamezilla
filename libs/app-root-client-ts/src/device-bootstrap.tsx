import { EnsureDeviceEntity } from '@libs/auth-client-ts/ensure-device-entity';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import type { JSX } from '@solidjs/web';
import { onSettled } from 'solid-js';

export function DeviceEntityBootstrap(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const client = useMutationClient();
  const log = useLogger('device-bootstrap');
  onSettled(() => {
    void new EnsureDeviceEntity(client).run().catch((error: unknown) => {
      log.warn('device bootstrap failed', { error: String(error) });
    });
  });
  return <>{props.children}</>;
}
