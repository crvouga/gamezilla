import { useLingui } from '@lingui/solid/macro';
import { ActionNotice } from '@pkgs/ui-root-client-ts/action-notice';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
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
    // Inside the page's gutter, like the screen under it.
    <StackVertical gap="sm" paddingX="lg">
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
        <ActionNotice
          icon={WifiOffIcon}
          title={t`You are offline`}
          body={t`Puzzles here and your saved work stay on this device. Changes share when you reconnect.`}
          action={{ label: t`Reconnect`, onClick: props.onReconnect }}
          dataSet={{ testid: 'content-offline' }}
        />
      </Show>
    </StackVertical>
  );
}
