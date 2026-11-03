import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';

export type ContentConnectionStatusViewProps = {
  /** Requested puzzles are still arriving. */
  readonly loading: boolean;
  readonly online: boolean;
  /** Why the last sync failed while online; null when it did not. */
  readonly lastError: string | null;
  readonly onReconnect: () => void;
};

/**
 * Above every content screen: requested puzzles still arriving, a sync
 * failure with a reconnect, or offline with saved work kept on the device.
 */
export function ContentConnectionStatusView(
  props: ContentConnectionStatusViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Show when={props.loading}>
        <P
          role="status"
          variant="caption"
          tone="secondary"
        >{t`Loading requested puzzles…`}</P>
      </Show>
      <Show when={props.online && props.lastError}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Changes have not reached your other devices`}
            body={error()}
            retry={{ label: t`Reconnect`, onClick: props.onReconnect }}
          />
        )}
      </Show>
      <Show when={!props.online}>
        <Notice
          dataSet={{ testid: 'content-offline' }}
        >{t`You are offline. Available puzzles and your saved work stay on this device. Changes share when connected.`}</Notice>
        <Button
          title={t`Reconnect`}
          intent="neutral"
          variant="outline"
          onClick={props.onReconnect}
        />
      </Show>
    </>
  );
}
