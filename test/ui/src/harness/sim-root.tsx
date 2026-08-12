/**
 * Sim-safe root layout for the full `@apps/client` Expo Router tree.
 *
 * Uses the real `app/` filesystem via `renderRouter({ appDir, overrides })`
 * and only replaces `_layout` so we can inject {@link Io} + {@link AppOverrides}
 * without Sentry.wrap / polyfill-entry wallIo.
 */

import '@apps/client/i18n/i18n';
import type { AppOverrides } from '@apps/client/providers/app-overrides';
import { AppProviders } from '@apps/client/providers/app-providers';
import { AppIoProvider } from '@apps/client/providers/infrastructure/app-io-provider';
import { RootErrorBoundary } from '@apps/client/providers/root-error-boundary';
import type { Io } from '@pkgs/io';
import { useStackProps } from '@pkgs/ui';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

/** Matches production `app/_layout.tsx` `unstable_settings`. */
export const simUnstableSettings = {
  anchor: '(tabs)',
} as const;

function AppStack(): ReactNode {
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
 * Production-shaped root layout with sim composition seams.
 * Loaded as the `./_layout.tsx` override over the real app directory.
 */
export function SimRootLayout(props: {
  readonly io: Io;
  readonly overrides: AppOverrides;
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
