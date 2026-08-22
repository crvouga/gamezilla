// @io-wall-ok — Expo composition root for Sim Console (Reports + Playground).

import { AppI18nProvider } from '@apps/client/i18n/i18n-provider';
import { AppUiPortals } from '@apps/client/providers/ui/portals';
import {
  ClockProvider,
  useClock,
  useTimers,
  wallClock,
  wallTimers,
} from '@pkgs/clock';
import { createStaticObjectStore } from '@pkgs/object-store/impl-static';
import { SimConsoleApp, type SimConsolePorts } from '@pkgs/sim-console/client';
import { AppThemeRoot, Box, createPassthroughBottomSheetHost } from '@pkgs/ui';
import { IdProvider } from '@pkgs/uuid';
import {
  ConsoleChromeProvider,
  useConsoleChrome,
} from '@sim/console/console-nav/console-chrome-context';
import { useConsoleNav } from '@sim/console/console-nav/use-console-nav';
import { bootPlaygroundSession } from '@sim/console/playground/boot-playground';
import { type ReactNode, useMemo } from 'react';

const REPORTS_PUBLIC_BASE = '/reports';
const simConsoleBottomSheetHost = createPassthroughBottomSheetHost();

function ConsoleBody(): ReactNode {
  const clock = useClock();
  const timers = useTimers();
  const { state, patch } = useConsoleChrome();
  const ports = useMemo((): SimConsolePorts => {
    const fetchFn = (input: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(input, init);
    return {
      bootPlayground: bootPlaygroundSession,
      clock,
      timers,
      fetch: fetchFn,
      reportsStore: createStaticObjectStore({
        baseUrl: REPORTS_PUBLIC_BASE,
        fetch: fetchFn,
      }),
      reportsPublicBaseUrl: REPORTS_PUBLIC_BASE,
    };
  }, [clock, timers]);
  return (
    <AppI18nProvider>
      <AppUiPortals host={simConsoleBottomSheetHost}>
        <SimConsoleApp
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

/** Expo root: Sim Console only (no product Client|Sim host chrome). */
export function RootApp(): ReactNode {
  const consoleNav = useConsoleNav();
  const createId = useMemo(() => () => crypto.randomUUID(), []);
  const random = useMemo(() => () => Math.random(), []);
  return (
    <ClockProvider clock={wallClock} timers={wallTimers}>
      <IdProvider createId={createId} random={random}>
        <AppThemeRoot>
          <ConsoleChromeProvider value={consoleNav}>
            <Box sx={rootSx}>
              <ConsoleBody />
            </Box>
          </ConsoleChromeProvider>
        </AppThemeRoot>
      </IdProvider>
    </ClockProvider>
  );
}

const rootSx = {
  flex: 1,
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minHeight: 0,
} as const;
