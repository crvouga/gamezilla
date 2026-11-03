import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { JSX } from 'solid-js';
import { ContentConnectionStatusView } from './content-connection-status-view';

/** The content screens' connection status, wired to the sync engine. */
export function ContentConnectionStatus(props: {
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
    />
  );
}
