// @io-wall-ok — Expo composition root for Main | Console sub-apps.
import { getApiBaseUrl } from '@apps/client/config/api-servers';
import { bootPlaygroundSession } from '@apps/client/host/boot-playground';
import { ClientHost } from '@apps/client/host/client-host';
import { HostChromeProvider } from '@apps/client/host/host-chrome-context';
import type { HostedSubApp } from '@apps/client/host/hosted-sub-app';
import { useHostNav } from '@apps/client/host/use-host-nav';
import { AppI18nProvider } from '@apps/client/i18n/i18n-provider';
import { ProductApp } from '@apps/client/product/app';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { AppUiPortals } from '@apps/client/providers/ui/portals';
import { defaultAppSyncEnginePool } from '@apps/client/sync/sync-engine-pool';
import { useIo, wallIo } from '@pkgs/io';
import { SystemProvider } from '@pkgs/system/react';
import {
  DEFAULT_REPORT_SERVER_PORT,
  SystemConsoleApp,
  type SystemConsolePorts,
} from '@pkgs/system-console/client';
import { AppThemeRoot, HouseIcon, TerminalIcon } from '@pkgs/ui';
import { type ReactNode, useEffect, useMemo } from 'react';

import { useHostChrome } from './host-chrome-context';

function isLocalApiOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function ConsoleSubApp(): ReactNode {
  const io = useIo();
  const { state, patch } = useHostChrome();
  const ports = useMemo((): SystemConsolePorts<ClientSystemResources> => {
    const apiOrigin = getApiBaseUrl().replace(/\/$/, '');
    // Local Jest sims write to `<repo>/system-console-data`. The Bun report
    // sidecar (`@pkgs/system-console#dev`) serves that tree; the API Worker
    // mount reads MinIO/B2 and stays for non-local / production.
    const reportApiBasePath = isLocalApiOrigin(apiOrigin)
      ? `http://localhost:${String(DEFAULT_REPORT_SERVER_PORT)}`
      : `${apiOrigin}/system-console`;
    return {
      ProductApp:
        ProductApp as SystemConsolePorts<ClientSystemResources>['ProductApp'],
      bootPlayground: bootPlaygroundSession,
      io,
      reportApiBasePath,
    };
  }, [io]);
  return (
    <AppI18nProvider>
      <AppUiPortals>
        <SystemConsoleApp
          ports={ports}
          section={state.section}
          kind={state.kind}
          view={state.view}
          clientViews={state.clientViews}
          onSectionChange={(section) => patch({ section })}
          onKindChange={(kind) => patch({ kind })}
          onViewChange={(view) => patch({ view })}
          onClientViewChange={(clientId, view) => {
            patch({ clientView: { id: clientId, view } });
          }}
        />
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
  const hostNav = useHostNav();
  return (
    <SystemProvider io={io}>
      <AppThemeRoot>
        <HostChromeProvider value={hostNav}>
          <ClientHost apps={apps} />
        </HostChromeProvider>
      </AppThemeRoot>
    </SystemProvider>
  );
}
