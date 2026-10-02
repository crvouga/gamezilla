/** @jsxImportSource solid-js */
/** Minimal theme root stays mounted when the feature/provider tree crashes. */
import type { Kv } from '@pkgs/kv/interface';
import { KvProvider } from '@pkgs/kv/solid';
import {
  ThemePreferenceProvider,
  ThemeProvider,
  useTestViewport,
  useThemePreference,
} from '@pkgs/ui';
import { type JSX, untrack } from 'solid-js';

function AppTheme(props: { readonly children: JSX.Element }): JSX.Element {
  const { preference } = useThemePreference();
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

export function AppThemeProvider(props: {
  readonly kv: Kv;
  readonly children: JSX.Element;
}): JSX.Element {
  const kv = untrack(() => props.kv);
  return (
    <KvProvider value={kv}>
      <ThemePreferenceProvider>
        <AppTheme>{props.children}</AppTheme>
      </ThemePreferenceProvider>
    </KvProvider>
  );
}
