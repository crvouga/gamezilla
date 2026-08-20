// @io-wall-ok — host composition root (Main vs Console).

import { getServerBaseUrl } from '@apps/client/config/api-servers';
import { bootPlaygroundSession } from '@apps/client/host/boot-playground';
import type { HostedSubApp } from '@apps/client/host/hosted-sub-app';
import { AppI18nProvider } from '@apps/client/i18n/i18n-provider';
import { createClient } from '@apps/client/product/create-client';
import { wallClientEnv } from '@apps/client/product/wall-client-env';
import { AppUiPortals } from '@apps/client/providers/ui/portals';
import { useClock, useTimers } from '@pkgs/clock';
import {
  DEFAULT_REPORT_SERVER_PORT,
  SystemConsoleApp,
  type SystemConsolePorts,
} from '@pkgs/system-console/client';
import { HouseIcon, TerminalIcon } from '@pkgs/ui';
import { createElement, type ReactNode, useEffect, useMemo } from 'react';

import { useHostChrome } from './host-chrome-context';

function isLocalServerOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function ConsoleSubApp(): ReactNode {
  const clock = useClock();
  const timers = useTimers();
  const { state, patch } = useHostChrome();
  const ports = useMemo((): SystemConsolePorts => {
    const origin = getServerBaseUrl().replace(/\/$/, '');
    const reportApiBasePath = isLocalServerOrigin(origin)
      ? `http://localhost:${String(DEFAULT_REPORT_SERVER_PORT)}`
      : `${origin}/system-console`;
    return {
      bootPlayground: bootPlaygroundSession,
      clock,
      timers,
      fetch: (input, init) => globalThis.fetch(input, init),
      reportApiBasePath,
    };
  }, [clock, timers]);
  return (
    <AppI18nProvider>
      <AppUiPortals>
        <SystemConsoleApp
          ports={ports}
          section={state.section}
          kind={state.kind}
          view={state.view}
          instance={state.instance}
          onSectionChange={(section) => patch({ section })}
          onKindChange={(kind) => patch({ kind })}
          onInstanceChange={(instance) => patch({ instance })}
          onViewChange={(view) => patch({ view })}
        />
      </AppUiPortals>
    </AppI18nProvider>
  );
}

function ClientSubApp(): ReactNode {
  const client = useMemo(() => createClient(wallClientEnv()), []);
  useEffect(() => {
    return () => {
      void client.close();
    };
  }, [client]);
  return createElement(client.App);
}

export function composeSubApps(): readonly HostedSubApp[] {
  return [
    { id: 'main', title: 'Client', icon: HouseIcon, App: ClientSubApp },
    { id: 'console', title: 'System', icon: TerminalIcon, App: ConsoleSubApp },
  ];
}
