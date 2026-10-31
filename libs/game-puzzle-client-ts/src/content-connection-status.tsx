import { useLingui } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';

export function ContentConnectionStatus(props: {
  loading: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const engine = useSyncEngine();
  return (
    <>
      <Show when={props.loading}>
        <P
          role="status"
          variant="caption"
          tone="secondary"
        >{t`Loading requested puzzles…`}</P>
      </Show>
      <Show when={engine.status().online && engine.status().lastError}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Changes have not reached your other devices`}
            body={error()}
            retry={{
              label: t`Reconnect`,
              onClick: () => {
                void engine.connect();
              },
            }}
          />
        )}
      </Show>
      <Show when={!engine.status().online}>
        <Notice
          dataSet={{ testid: 'content-offline' }}
        >{t`You are offline. Available puzzles and your saved work stay on this device. Changes share when connected.`}</Notice>
        <Button
          title={t`Reconnect`}
          intent="neutral"
          variant="outline"
          onClick={() => {
            void engine.connect();
          }}
        />
      </Show>
    </>
  );
}
