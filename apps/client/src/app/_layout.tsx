import { AppProviders } from '@apps/client/providers/app-providers';
import { RootErrorBoundary } from '@apps/client/providers/root-error-boundary';
import { isClientSentryEnabled } from '@pkgs/observability/impl-sentry/init-client-sentry';
import { useStackProps } from '@pkgs/ui';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

import '@apps/client/polyfill-entry';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppStack() {
  const props = useStackProps();

  return (
    <Stack {...props}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="space" />
      <Stack.Screen name="more" />
      <Stack.Screen name="ui" />
      <Stack.Screen
        name="sso-callback"
        options={{
          headerShown: false,
          animation: 'fade' as const,
        }}
      />
    </Stack>
  );
}

function RootLayout() {
  return (
    <RootErrorBoundary>
      <AppProviders>
        <AppStack />
      </AppProviders>
    </RootErrorBoundary>
  );
}

export default isClientSentryEnabled() ? Sentry.wrap(RootLayout) : RootLayout;
