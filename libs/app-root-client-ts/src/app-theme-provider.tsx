/** @jsxImportSource @solidjs/web */
/** The visual shell and motion preference stay mounted during crash recovery. */
import type { MotionPreferencePort } from '@pkgs/device-shared-ts/motion-preference';
import { KvProvider } from '@pkgs/kv-root-client-ts/solid';
import type { Kv } from '@pkgs/kv-root-shared-ts/interface';
import { useTestViewport } from '@pkgs/ui-root-client-ts/test-viewport';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import type { JSX } from '@solidjs/web';
import { createSignal, onCleanup, untrack } from 'solid-js';

export function AppThemeProvider(props: {
  readonly kv: Kv;
  readonly motion: MotionPreferencePort;
  readonly children: JSX.Element;
}): JSX.Element {
  const kv = untrack(() => props.kv);
  const viewport = useTestViewport();
  const motion = untrack(() => props.motion);
  const [reduced, setReduced] = createSignal(motion.reduced());
  onCleanup(motion.subscribe(setReduced));
  return (
    <KvProvider value={kv}>
      <ThemeProvider
        reducedMotion={reduced()}
        {...(viewport ? { fixedLayout: viewport } : {})}
      >
        {props.children}
      </ThemeProvider>
    </KvProvider>
  );
}
