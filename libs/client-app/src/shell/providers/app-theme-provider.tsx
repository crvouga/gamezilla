/** @jsxImportSource solid-js */
/** Minimal theme root stays mounted when the feature/provider tree crashes. */

import type { MotionPreferencePort } from '@pkgs/device/motion-preference';
import type { Kv } from '@pkgs/kv/interface';
import { KvProvider } from '@pkgs/kv/solid';
import {
  ThemePreferenceProvider,
  ThemeProvider,
  useTestViewport,
  useThemePreference,
} from '@pkgs/ui';
import { createSignal, type JSX, onCleanup, untrack } from 'solid-js';

function AppTheme(props: {
  readonly motion: MotionPreferencePort;
  readonly children: JSX.Element;
}): JSX.Element {
  const { preference } = useThemePreference();
  const testViewport = useTestViewport();
  const motion = untrack(() => props.motion);
  const [reduced, setReduced] = createSignal(motion.reduced());
  onCleanup(motion.subscribe(setReduced));
  return (
    <ThemeProvider
      colorScheme={preference()}
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
