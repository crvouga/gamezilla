import { useClientConfig } from '@libs/client-config/client/use-client-config';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import { useEffect } from 'react';

import { setEmqxUrlForDatabase } from '../../sync/emqx-url-holder';

/**
 * After `client_config` hydrates an EMQX WSS URL, attach MQTT push if connect
 * earlier ran poll-only (cold start with empty local rows).
 */
export function SyncEmqxPushFromClientConfig({
  databaseName,
}: {
  readonly databaseName: string;
}): null {
  const { config } = useClientConfig();
  const engine = useSyncEngine();
  const wssUrl = config.emqx_wss_url;

  useEffect(() => {
    const url = wssUrl?.trim() ?? '';
    if (url.length === 0) return;
    setEmqxUrlForDatabase(databaseName, url);
    engine.ensurePush();
  }, [databaseName, engine, wssUrl]);

  return null;
}
