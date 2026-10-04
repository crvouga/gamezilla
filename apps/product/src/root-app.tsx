import type { I18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { HarnessConsoleApp } from '@pkgs/harness-console-client/app';
import type { HarnessConsolePorts } from '@pkgs/harness-console-shared/ports';
import { HttpClientProvider } from '@pkgs/http-client-client/solid';
import { DismissibleBannerPortalProvider } from '@pkgs/ui-client/dismissible-top-banner';
import { OverlayPortalProvider } from '@pkgs/ui-client/overlay-portal';
import { SurfaceStackProvider } from '@pkgs/ui-client/surface-stack';
import { ThemeProvider } from '@pkgs/ui-client/theme-context';
import {
  ThemePreferenceProvider,
  useThemePreference,
} from '@pkgs/ui-client/theme-preference';
import { IdProvider } from '@pkgs/uuid-client/solid';
import type { CreateId, Random } from '@pkgs/uuid-shared/create-id';
import type { JSX } from 'solid-js';
import {
  ConsoleChromeProvider,
  useConsoleChrome,
} from './console-chrome-context';
import { useConsoleNav } from './use-console-nav';

export type ConsoleEnv = {
  readonly ports: HarnessConsolePorts;
  readonly createId: CreateId;
  readonly random: Random;
  readonly i18n: I18n;
};

function ConsoleBody(props: {
  readonly ports: HarnessConsolePorts;
}): JSX.Element {
  const nav = useConsoleChrome();
  return (
    <HarnessConsoleApp
      ports={props.ports}
      kind={nav.state.harness.kind}
      instance={nav.state.harness.instance}
      panes={nav.state.harness.panes}
      onExit={() => {
        window.location.assign('/');
      }}
      onKindChange={(kind) => nav.patch({ harness: { kind } })}
      onInstanceChange={(instance) => nav.patch({ harness: { instance } })}
      onPanePatch={(id, patch, mode = 'push') =>
        nav.patch({ harness: { pane: { id, patch } } }, mode)
      }
    />
  );
}

function ConsoleShell(props: {
  readonly ports: HarnessConsolePorts;
}): JSX.Element {
  const theme = useThemePreference();
  const nav = useConsoleNav();
  return (
    <ConsoleChromeProvider value={nav}>
      <ThemeProvider colorScheme={theme.preference()}>
        <OverlayPortalProvider>
          <SurfaceStackProvider>
            <DismissibleBannerPortalProvider>
              <div class="box flex-1 min-h-0 min-w-0">
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
