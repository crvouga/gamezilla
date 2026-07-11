import { useMyId } from '@libs/auth/client/use-current-user';
import { useConfigService } from '@libs/auth/client/config-service-context';
import { useKv } from '@pkgs/kv/kv-context';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/observability-provider';
import { RegisterCommand } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { fetchSyncToken, type SyncApiFetch } from '../../sync/sync-api';

// eslint-disable-next-line lingui/no-unlocalized-strings -- external diagnostics URL, not user-facing copy
const DIAGNOSTICS_APP_URL = 'https://diagnostics-app.powersync.com/';

function openDiagnosticsTab(url: string): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line lingui/no-unlocalized-strings -- browser API args, not user-facing copy
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void WebBrowser.openBrowserAsync(url);
}

export function PowerSyncDiagnosticsCommand(): ReactNode {
  const { t } = useLingui();
  const config = useConfigService();
  const kv = useKv();
  const observability = useObservability();
  const myId = useMyId();
  const fetchFn = useMemo(
    () => instrumentFetch(observability, fetch) as SyncApiFetch,
    [observability]
  );

  const run = useCallback(async () => {
    const { token } = await fetchSyncToken({ config, fetchFn, kv });
    const url = new URL(DIAGNOSTICS_APP_URL);
    // eslint-disable-next-line lingui/no-unlocalized-strings -- query param name required by diagnostics app
    url.searchParams.set('token', token);
    openDiagnosticsTab(url.toString());
  }, [config, fetchFn, kv]);

  return (
    <RegisterCommand
      id="dev:powersync-diagnostics"
      title={t`Open PowerSync diagnostics`}
      subtitle={
        myId.length > 0
          ? t`Current user: ${myId}`
          : t`Mint sync token and open diagnostics app`
      }
      category={t`Developer`}
      icon="wifi"
      keywords={[
        t`powersync`,
        t`diagnostics`,
        t`sync`,
        t`debug`,
        t`developer`,
        t`token`,
      ]}
      enabled={myId.length > 0}
      run={run}
    />
  );
}
