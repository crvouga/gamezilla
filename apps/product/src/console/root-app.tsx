import type { I18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock/solid';
import { HttpClientProvider } from '@pkgs/http-client/solid';
import { SimConsoleApp, type SimConsolePorts } from '@pkgs/sim-console/client';
import {
  DismissibleBannerPortalProvider,
  OverlayPortalProvider,
  SurfaceStackProvider,
  ThemePreferenceProvider,
  ThemeProvider,
  useThemePreference,
} from '@pkgs/ui';
import type { CreateId, Random } from '@pkgs/uuid/create-id';
import { IdProvider } from '@pkgs/uuid/solid';
import type { JSX } from 'solid-js';
import {
  ConsoleChromeProvider,
  useConsoleChrome,
} from './console-nav/console-chrome-context';
import { useConsoleNav } from './console-nav/use-console-nav';

export type ConsoleEnv = {
  readonly ports: SimConsolePorts;
  readonly createId: CreateId;
  readonly random: Random;
  readonly i18n: I18n;
};

function ConsoleBody(props: { readonly ports: SimConsolePorts }): JSX.Element {
  const nav = useConsoleChrome();
  return (
    <SimConsoleApp
      ports={props.ports}
      kind={nav.state.simulator.kind}
      instance={nav.state.simulator.instance}
      panes={nav.state.simulator.panes}
      onExit={() => {
        window.location.assign('/');
      }}
      onKindChange={(kind) => nav.patch({ simulator: { kind } })}
      onInstanceChange={(instance) => nav.patch({ simulator: { instance } })}
      onPanePatch={(id, patch, mode = 'push') =>
        nav.patch({ simulator: { pane: { id, patch } } }, mode)
      }
    />
  );
}

function ConsoleShell(props: { readonly ports: SimConsolePorts }): JSX.Element {
  const theme = useThemePreference();
  const nav = useConsoleNav();
  return (
    <ConsoleChromeProvider value={nav}>
      <ThemeProvider colorScheme={theme.preference()}>
        <OverlayPortalProvider>
          <SurfaceStackProvider>
            <DismissibleBannerPortalProvider>
              <div class="box flex-1 min-h-[0] min-w-[0]">
                <ConsoleBody ports={props.ports} />
              </div>
            </DismissibleBannerPortalProvider>
          </SurfaceStackProvider>
        </OverlayPortalProvider>
      </ThemeProvider>
    </ConsoleChromeProvider>
  );
}

/** Console chrome only. Embedded product apps own their isolated providers. */
export function RootApp(props: { readonly env: ConsoleEnv }): JSX.Element {
  return (
    <ClockProvider
      clock={props.env.ports.clock}
      timers={props.env.ports.timers}
    >
      <HttpClientProvider value={{ fetch: props.env.ports.fetch }}>
        <IdProvider createId={props.env.createId} random={props.env.random}>
          <I18nProvider i18n={props.env.i18n}>
            <ThemePreferenceProvider>
              <ConsoleShell ports={props.env.ports} />
            </ThemePreferenceProvider>
          </I18nProvider>
        </IdProvider>
      </HttpClientProvider>
    </ClockProvider>
  );
}
