import { EnsureDeviceEntity } from '@libs/auth-client/ensure-device-entity';
import { useLogger } from '@pkgs/logger-client/solid';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { type JSX, onMount } from 'solid-js';

export function DeviceEntityBootstrap(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const client = useMutationClient();
  const log = useLogger('device-bootstrap');
  onMount(() => {
    void new EnsureDeviceEntity(client).run().catch((error: unknown) => {
      log.warn('device bootstrap failed', { error: String(error) });
    });
  });
  return <>{props.children}</>;
}
