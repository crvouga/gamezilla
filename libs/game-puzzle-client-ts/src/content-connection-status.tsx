import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { JSX } from '@solidjs/web';
import { ContentConnectionStatusView } from './content-connection-status-view';

/** The content screens' connection status, wired to the sync engine. */
export function ContentConnectionStatus(props: {
  children: JSX.Element;
  loading: boolean;
}): JSX.Element {
  const engine = useSyncEngine();
  return (
    <ContentConnectionStatusView
      loading={props.loading}
      online={engine.status().online}
      lastError={engine.status().lastError}
      onReconnect={() => {
        void engine.connect();
      }}
    >
      {props.children}
    </ContentConnectionStatusView>
  );
}
