/** @jsxImportSource solid-js */
/**
 * Platform shell. Sits under `ClientEnvProvider` and `AppThemeProvider`.
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
import {
  AudioPlaybackProvider,
  SoundEngineProvider,
  SoundsPreferenceProvider,
} from '@pkgs/sounds/solid';
import { SpinnerProvider } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { LocalPaintLatchProvider } from '../boot/local-paint-latch';
import { useClientEnv } from '../client-env-context';
import { i18n } from '../i18n';
import { PerfRoot } from '../perf/perf-root';
import { DevicePortsProvider } from './device-ports-context';

export function AppShellProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const env = useClientEnv();
  return (
    <DevicePortsProvider network={env.network} devMenu={env.devMenu}>
      <AudioPlaybackProvider value={env.audio}>
        <LocalPaintLatchProvider>
          <SoundsPreferenceProvider>
            <SoundEngineProvider>
              <I18nProvider i18n={i18n}>
                <SpinnerProvider>
                  <PerfRoot>{props.children}</PerfRoot>
                </SpinnerProvider>
              </I18nProvider>
            </SoundEngineProvider>
          </SoundsPreferenceProvider>
        </LocalPaintLatchProvider>
      </AudioPlaybackProvider>
    </DevicePortsProvider>
  );
}
