/** @jsxImportSource solid-js */
/** Minimal theme root stays mounted when the sub/provider tree crashes. */

import type { MotionPreferencePort } from '@pkgs/device-shared/motion-preference';
import { KvProvider } from '@pkgs/kv-root-client/solid';
import type { Kv } from '@pkgs/kv-root-shared/interface';
import { useTestViewport } from '@pkgs/ui-root-client/test-viewport';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import {
  ThemePreferenceProvider,
  useThemePreference,
} from '@pkgs/ui-root-client/theme-preference';
import type { ColorScheme } from '@pkgs/ui-root-shared/colors-types';
import { createSignal, type JSX, onCleanup, untrack } from 'solid-js';

/** The scheme `index.html` painted before the app loaded, when it set one. */
function paintedScheme(): ColorScheme | undefined {
  const scheme = document.documentElement.getAttribute('data-theme');
  return scheme === 'light' || scheme === 'dark' ? scheme : undefined;
}

function AppTheme(props: {
  readonly motion: MotionPreferencePort;
  readonly children: JSX.Element;
}): JSX.Element {
  const { preference, settled } = useThemePreference();
  // Hold the painted scheme until the stored preference is read, so the first
  // frame never shows the system scheme over a pinned one.
  const painted = paintedScheme();
  const testViewport = useTestViewport();
  const motion = untrack(() => props.motion);
  const [reduced, setReduced] = createSignal(motion.reduced());
  onCleanup(motion.subscribe(setReduced));
  return (
    <ThemeProvider
      colorScheme={settled() ? preference() : (painted ?? preference())}
      reducedMotion={reduced()}
      {...(testViewport != null ? { fixedLayout: testViewport } : {})}
    >
      {props.children}
    </ThemeProvider>
  );
}

export function AppThemeProvider(props: {
  readonly kv: Kv;
  readonly motion: MotionPreferencePort;
  readonly children: JSX.Element;
}): JSX.Element {
  const kv = untrack(() => props.kv);
  return (
    <KvProvider value={kv}>
      <ThemePreferenceProvider>
        <AppTheme motion={props.motion}>{props.children}</AppTheme>
      </ThemePreferenceProvider>
    </KvProvider>
  );
}
