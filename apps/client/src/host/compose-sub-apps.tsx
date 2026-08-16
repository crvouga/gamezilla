// @io-wall-ok — Expo composition root for Main | Console sub-apps.
import { getApiBaseUrl } from '@apps/client/config/api-servers';
import { bootPlaygroundSession } from '@apps/client/host/boot-playground';
import { ClientHost } from '@apps/client/host/client-host';
import type { HostedSubApp } from '@apps/client/host/hosted-sub-app';
import { ProductApp } from '@apps/client/product/app';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { defaultAppSyncEnginePool } from '@apps/client/sync/sync-engine-pool';
import { useIo, wallIo } from '@pkgs/io';
import { SystemProvider } from '@pkgs/system/react';
import {
  SystemConsoleApp,
  type SystemConsolePorts,
} from '@pkgs/system-console/client';
import { AppThemeRoot } from '@pkgs/ui';
import { type ReactNode, useEffect, useMemo } from 'react';

function ConsoleSubApp(): ReactNode {
  const io = useIo();
  const ports = useMemo((): SystemConsolePorts<ClientSystemResources> => {
    const apiOrigin = getApiBaseUrl().replace(/\/$/, '');
    return {
      ProductApp:
        ProductApp as SystemConsolePorts<ClientSystemResources>['ProductApp'],
      bootPlayground: bootPlaygroundSession,
      io,
      reportApiBasePath: `${apiOrigin}/system-console`,
    };
  }, [io]);
  return <SystemConsoleApp ports={ports} />;
}

/**
 * Release Main's identity OPFS handles when leaving for Console — otherwise
 * playground / remount hits Access Handle contention on the same `user_*` DB.
 */
function MainSubApp(): ReactNode {
  useEffect(() => {
    return () => {
      void defaultAppSyncEnginePool.releaseAll();
    };
  }, []);
  return <ProductApp />;
}

export function composeSubApps(): readonly HostedSubApp[] {
  return [
    { id: 'main', title: 'Main', App: MainSubApp },
    { id: 'console', title: 'Console', App: ConsoleSubApp },
  ];
}

/** Expo root: host chrome + injected Main / Console. */
export function RootApp(): ReactNode {
  const io = useMemo(() => wallIo(), []);
  const apps = useMemo(() => composeSubApps(), []);
  // SystemProvider (clock) must wrap AppThemeRoot — ThemePreference uses useKvState → useClock.
  return (
    <SystemProvider io={io}>
      <AppThemeRoot>
        <ClientHost apps={apps} />
      </AppThemeRoot>
    </SystemProvider>
  );
}
