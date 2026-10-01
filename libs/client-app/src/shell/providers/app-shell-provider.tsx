/** @jsxImportSource solid-js */
/**
 * Platform shell (outermost stage). Must sit under `ClientEnvProvider`.
 *
 * RN → web deltas: the gesture root and safe-area provider are gone
 * (CSS `env()` insets); typography uses the system font stack from `@pkgs/ui`
 * (see README.md) and
 * mark the paint latch through `document.fonts.ready`; the RN suspense root is
 * not needed (Solid `lazy` routes suspend inside the router outlet).
 *
 * `PerfRoot` (perf HUD preference + sampler) mounts inside the theme so the
 * `/more/performance` toggle and the palette commands share one preference.
 * The HUD banner itself mounts in `AppUiProvider` via the in-flow banner
 * portal so it pushes content instead of covering it.
 */

import { I18nProvider } from '@lingui/solid';
import { KvProvider } from '@pkgs/kv/solid';
import {
  AudioPlaybackProvider,
  SoundEngineProvider,
  SoundsPreferenceProvider,
} from '@pkgs/sounds/solid';
import {
  SpinnerProvider,
  ThemePreferenceProvider,
  ThemeProvider,
  useTestViewport,
  useThemePreference,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { LocalPaintLatchProvider } from '../boot/local-paint-latch';
import { useClientEnv } from '../client-env-context';
import { i18n } from '../i18n';
import { PerfRoot } from '../perf/perf-root';
import { DevicePortsProvider } from './device-ports-context';

function AppTheme(props: { readonly children: JSX.Element }): JSX.Element {
  const { preference } = useThemePreference();
  // Harnesses wrap the app in TestViewportProvider (happy-dom has no layout). Real
  // clients leave it unset so ThemeProvider measures via ResizeObserver.
  const testViewport = useTestViewport();
  return (
    <ThemeProvider
      colorScheme={preference()}
      {...(testViewport != null ? { fixedLayout: testViewport } : {})}
    >
      {props.children}
    </ThemeProvider>
  );
}

export function AppShellProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  return (
    <DevicePortsProvider network={env.network} devMenu={env.devMenu}>
      <AudioPlaybackProvider value={env.audio}>
        <LocalPaintLatchProvider>
          <KvProvider value={env.kv}>
            <SoundsPreferenceProvider>
              <SoundEngineProvider>
                <ThemePreferenceProvider>
                  <AppTheme>
                    <I18nProvider i18n={i18n}>
                      <SpinnerProvider>
                        <PerfRoot>{props.children}</PerfRoot>
                      </SpinnerProvider>
                    </I18nProvider>
                  </AppTheme>
                </ThemePreferenceProvider>
              </SoundEngineProvider>
            </SoundsPreferenceProvider>
          </KvProvider>
        </LocalPaintLatchProvider>
      </AudioPlaybackProvider>
    </DevicePortsProvider>
  );
}
