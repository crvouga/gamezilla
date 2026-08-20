// @io-wall-ok — Expo composition root for System Console (Reports + Playground).

import { AppI18nProvider } from '@apps/client/i18n/i18n-provider';
import { AppUiPortals } from '@apps/client/providers/ui/portals';
import {
  ConsoleChromeProvider,
  useConsoleChrome,
} from '@apps/system/console-nav/console-chrome-context';
import { useConsoleNav } from '@apps/system/console-nav/use-console-nav';
import { bootPlaygroundSession } from '@apps/system/playground/boot-playground';
import {
  ClockProvider,
  useClock,
  useTimers,
  wallClock,
  wallTimers,
} from '@pkgs/clock';
import {
  DEFAULT_REPORT_SERVER_PORT,
  SystemConsoleApp,
  type SystemConsolePorts,
} from '@pkgs/system-console/client';
import { AppThemeRoot, Box } from '@pkgs/ui';
import { IdProvider } from '@pkgs/uuid';
import { type ReactNode, useMemo } from 'react';

function ConsoleBody(): ReactNode {
  const clock = useClock();
  const timers = useTimers();
  const { state, patch } = useConsoleChrome();
  const ports = useMemo((): SystemConsolePorts => {
    return {
      bootPlayground: bootPlaygroundSession,
      clock,
      timers,
      fetch: (input, init) => globalThis.fetch(input, init),
      reportApiBasePath: `http://localhost:${String(DEFAULT_REPORT_SERVER_PORT)}`,
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

/** Expo root: System Console only (no product Client|System host chrome). */
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
