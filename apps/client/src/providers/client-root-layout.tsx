/**
 * Shared Expo Router root composition for production and DST harness.
 *
 * Production `app/_layout.tsx` wraps this with polyfill / Sentry.
 * Sims inject {@link Io} + {@link AppOverrides} and never load polyfill-entry.
 */

import type { AppOverrides } from '@apps/client/providers/app-overrides';
import { AppProviders } from '@apps/client/providers/app-providers';
import { AppIoProvider } from '@apps/client/providers/infrastructure/app-io-provider';
import { RootErrorBoundary } from '@apps/client/providers/root-error-boundary';
import type { Io } from '@pkgs/io';
import { useStackProps } from '@pkgs/ui';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

/** Matches Expo Router `unstable_settings` on the root layout. */
export const clientUnstableSettings = {
  anchor: '(tabs)',
} as const;

export function AppStack(): ReactNode {
  const props = useStackProps();
  return (
    <Stack {...props}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="space"
        options={{ presentation: 'fullScreenModal' as const }}
      />
      <Stack.Screen name="profile" />
      <Stack.Screen name="more" />
      <Stack.Screen name="ui" />
      <Stack.Screen
        name="sso-callback"
        options={{ headerShown: false, animation: 'fade' as const }}
      />
    </Stack>
  );
}

/**
 * Provider + stack shell. Pass `io` / `overrides` from simulations; omit for
 * production (defaults to wall Io and empty overrides).
 */
export function ClientRootLayout(props: {
  readonly io?: Io;
  readonly overrides?: AppOverrides;
}): ReactNode {
  return (
    <AppIoProvider io={props.io}>
      <RootErrorBoundary>
        <AppProviders overrides={props.overrides}>
          <AppStack />
        </AppProviders>
      </RootErrorBoundary>
    </AppIoProvider>
  );
}
