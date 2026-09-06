// @io-wall-ok — Expo composition root for Console (Reports + Playground).

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
import { createClientFsObjectStore } from '@pkgs/object-store-expo-fs/impl-client-fs';
import { wallExpoFs } from '@pkgs/object-store-expo-fs/wall-expo-fs';
import {
  type BootPlaygroundOptions,
  type PlaygroundSession,
  SimConsoleApp,
  type SimConsolePorts,
} from '@pkgs/sim-console/client';
import {
  AppThemeRoot,
  Box,
  createPassthroughBottomSheetHost,
} from '@pkgs/ui-rn';
import { IdProvider } from '@pkgs/uuid';
import {
  ConsoleChromeProvider,
  useConsoleChrome,
} from '@product/console/console-nav/console-chrome-context';
import { useConsoleNav } from '@product/console/console-nav/use-console-nav';
import { reportsPublicBaseUrl } from '@product/console/reports-public-base';
import { type ReactNode, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const simConsoleBottomSheetHost = createPassthroughBottomSheetHost();
const fallbackInitialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
} as const;

/**
 * Defer `@product/sim/fabric/create-sim` until Playground boots. Eager import of
 * that graph makes Metro's iOS delta bundler throw `nullthrows` and leaves
 * Expo Go blank. Uses `import()` (async chunk) so the heavy graph stays out
 * of the initial bundle — do not stub `location` on native or Expo builds
 * chunk URLs against the wrong origin (`Could not load bundle`).
 */
async function bootPlaygroundLazy(
  opts?: BootPlaygroundOptions
): Promise<PlaygroundSession> {
  try {
    const { bootPlaygroundSession } = await import(
      '@product/console/playground/boot-playground'
    );
    return await bootPlaygroundSession(opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('Could not load bundle') ||
      msg.includes('LoadBundleFromServer') ||
      msg.includes('Metro HMR disconnected') ||
      msg.includes("property 'reload'") ||
      msg.includes("property 'replace'") ||
      msg.includes('reload of undefined')
    ) {
      throw new Error(
        `Playground chunk failed to load from Metro (${msg}). Restart bun dev and hard-reload Expo Go.`
      );
    }
    throw err;
  }
}

function ConsoleBody(): ReactNode {
  const clock = useClock();
  const timers = useTimers();
  const { state, patch } = useConsoleChrome();
  const ports = useMemo((): SimConsolePorts => {
    const fetchFn = (input: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(input, init);
    const reportsBase = reportsPublicBaseUrl();
    return {
      bootPlayground: bootPlaygroundLazy,
      clock,
      timers,
      fetch: fetchFn,
      reportsStore: createStaticObjectStore({
        baseUrl: reportsBase,
        fetch: fetchFn,
      }),
      reportsPublicBaseUrl: reportsBase,
      notebookStore: createClientFsObjectStore({
        baseDir: 'sql-notebooks',
        expoFs: wallExpoFs(),
      }),
    };
  }, [clock, timers]);
  return (
    <AppI18nProvider>
      <AppUiPortals host={simConsoleBottomSheetHost}>
        <SimConsoleApp
          ports={ports}
          section={state.section}
          kind={state.playground.kind}
          instance={state.playground.instance}
          panes={state.playground.panes}
          reports={state.reports}
          onSectionChange={(section) => patch({ section })}
          onKindChange={(kind) => patch({ playground: { kind } })}
          onInstanceChange={(instance) => patch({ playground: { instance } })}
          onPanePatch={(id, panePatch, mode = 'push') =>
            patch({ playground: { pane: { id, patch: panePatch } } }, mode)
          }
          onReportsNav={(reports, mode = 'push') => patch({ reports }, mode)}
        />
      </AppUiPortals>
    </AppI18nProvider>
  );
}

function ConsoleSafeShell(): ReactNode {
  const insets = useSafeAreaInsets();
  const consoleNav = useConsoleNav();
  return (
    <ConsoleChromeProvider value={consoleNav}>
      <Box
        sx={{
          ...rootSx,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
      >
        <ConsoleBody />
      </Box>
    </ConsoleChromeProvider>
  );
}

/** Expo root: Console only (no product Client|Sim host chrome). */
export function RootApp(): ReactNode {
  const createId = useMemo(() => () => crypto.randomUUID(), []);
  const random = useMemo(() => () => Math.random(), []);
  return (
    <GestureHandlerRootView style={gestureRootStyle}>
      <SafeAreaProvider
        initialMetrics={initialWindowMetrics ?? fallbackInitialMetrics}
      >
        <ClockProvider clock={wallClock} timers={wallTimers}>
          <IdProvider createId={createId} random={random}>
            <AppThemeRoot>
              <ConsoleSafeShell />
            </AppThemeRoot>
          </IdProvider>
        </ClockProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const gestureRootStyle = { flex: 1 } as const;

const rootSx = {
  flex: 1,
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minHeight: 0,
} as const;
