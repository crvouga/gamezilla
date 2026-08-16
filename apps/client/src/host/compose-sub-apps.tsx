// @io-wall-ok — Expo composition root for Main | Console sub-apps.
import { getApiBaseUrl } from '@apps/client/config/api-servers';
import { bootPlaygroundSession } from '@apps/client/host/boot-playground';
import { ClientHost } from '@apps/client/host/client-host';
import type { HostedSubApp } from '@apps/client/host/hosted-sub-app';
import { AppI18nProvider } from '@apps/client/i18n/i18n-provider';
import { ProductApp } from '@apps/client/product/app';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { AppUiPortals } from '@apps/client/providers/ui/portals';
import { defaultAppSyncEnginePool } from '@apps/client/sync/sync-engine-pool';
import { useIo, wallIo } from '@pkgs/io';
import { SystemProvider } from '@pkgs/system/react';
import {
  SystemConsoleApp,
  type SystemConsolePorts,
} from '@pkgs/system-console/client';
import { AppThemeRoot, HouseIcon, TerminalIcon } from '@pkgs/ui';
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
  // Console is outside ProductApp's shell — CommandPalette / other @pkgs/ui
  // surfaces still call useLingui. AppUiPortals supplies SurfaceStack for
  // Session wipe MutationModal (and any other console overlays).
  return (
    <AppI18nProvider>
      <AppUiPortals>
        <SystemConsoleApp ports={ports} />
      </AppUiPortals>
    </AppI18nProvider>
  );
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
    { id: 'main', title: 'Main', icon: HouseIcon, App: MainSubApp },
    { id: 'console', title: 'Console', icon: TerminalIcon, App: ConsoleSubApp },
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
