import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { Notice } from '@pkgs/ui-root-client/notice';
import { type JSX, Show } from 'solid-js';

/**
 * Says what is missing when this device has never finished a sync and the
 * last attempt failed: account data that lives on the server (other devices,
 * sign-in methods) has not reached this copy yet.
 */
export function AccountSyncErrorNotice(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const { status } = useSyncEngine();
  const failed = (): boolean =>
    !status().hasEverSynced && status().lastError !== null;
  return (
    <Show when={failed()}>
      <Notice tone="warning">{props.children}</Notice>
    </Show>
  );
}
