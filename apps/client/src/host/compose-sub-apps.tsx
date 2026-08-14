// @io-wall-ok — Expo composition root for Main | Console sub-apps.
import { getApiBaseUrl } from '@apps/client/config/api-servers';
import { bootPlaygroundSession } from '@apps/client/host/boot-playground';
import { ClientHost } from '@apps/client/host/client-host';
import type { HostedSubApp } from '@apps/client/host/hosted-sub-app';
import { ProductApp } from '@apps/client/product/app';
import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import { wallIo } from '@pkgs/io';
import {
  SystemConsoleApp,
  type SystemConsolePorts,
} from '@pkgs/system-console/client';
import { type ReactNode, useMemo } from 'react';

function ConsoleSubApp(): ReactNode {
  const ports = useMemo((): SystemConsolePorts<ClientSystemResources> => {
    const apiOrigin = getApiBaseUrl().replace(/\/$/, '');
    return {
      ProductApp:
        ProductApp as SystemConsolePorts<ClientSystemResources>['ProductApp'],
      bootPlayground: bootPlaygroundSession,
      io: wallIo(),
      reportApiBasePath: `${apiOrigin}/system-console`,
    };
  }, []);
  return <SystemConsoleApp ports={ports} />;
}

function MainSubApp(): ReactNode {
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
  const apps = useMemo(() => composeSubApps(), []);
  return <ClientHost apps={apps} />;
}
