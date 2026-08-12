/**
 * Full production provider tree for a single actor session.
 *
 * Avoids the real `apps/client/src/app/_layout.tsx` (Sentry.wrap + wallIo
 * polyfill entry). Expo Router context comes from
 * `expo-router/testing-library` `renderRouter` in the harness mount path.
 */

import '@apps/client/i18n/i18n';
import AccountRoute from '@apps/client/app/more/account/index';
import type { AppOverrides } from '@apps/client/providers/app-overrides';
import { AppProviders } from '@apps/client/providers/app-providers';
import { AppIoProvider } from '@apps/client/providers/infrastructure/app-io-provider';
import { RootErrorBoundary } from '@apps/client/providers/root-error-boundary';
import type { Io } from '@pkgs/io';
import { Box, Text } from '@pkgs/ui';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

function SpacesPlaceholder(): ReactNode {
  return (
    <Box testID="sim-spaces-home">
      <Text label="Spaces" />
    </Box>
  );
}

/** Expo Router layout wrapping the real app provider stack. */
export function SimLayout(props: {
  readonly io: Io;
  readonly overrides: AppOverrides;
}): ReactNode {
  return (
    <AppIoProvider io={props.io}>
      <RootErrorBoundary>
        <AppProviders overrides={props.overrides}>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProviders>
      </RootErrorBoundary>
    </AppIoProvider>
  );
}

export function SimSpacesHome(): ReactNode {
  return <SpacesPlaceholder />;
}

export function SimAccountScreen(): ReactNode {
  return <AccountRoute />;
}
