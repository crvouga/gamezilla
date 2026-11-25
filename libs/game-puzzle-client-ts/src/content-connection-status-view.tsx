import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

export type ContentConnectionStatusViewProps = {
  readonly children: JSX.Element;
  /** Requested puzzles are still arriving. */
  readonly loading: boolean;
  readonly online: boolean;
  /** Why the last sync failed while online; null when it did not. */
  readonly lastError: string | null;
  readonly onReconnect: () => void;
};

/**
 * Keep the screen controls ahead of notices that appear and disappear as
 * the connection changes, so reconnecting does not move a tap target.
 */
export function ContentConnectionStatusView(
  props: ContentConnectionStatusViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      {props.children}
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
