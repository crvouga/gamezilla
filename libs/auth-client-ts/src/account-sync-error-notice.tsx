import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { type JSX, Show } from 'solid-js';

/**
 * Says what is missing when this device has never finished a sync and the
 * last attempt failed: account data that lives on the server (other devices,
 * sign-in methods) has not reached this copy yet.
 */
export function AccountSyncErrorNotice(props: {
  /** From `useFirstSyncFailed`. */
  readonly failed: boolean;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <Show when={props.failed}>
      <Notice tone="warning">{props.children}</Notice>
    </Show>
  );
}
