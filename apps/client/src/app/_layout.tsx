import { AppProviders } from '@apps/client/providers/app-providers';
import { AppIoProvider } from '@apps/client/providers/infrastructure/app-io-provider';
import { RootErrorBoundary } from '@apps/client/providers/root-error-boundary';
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

function RootLayout() {
  return (
    <AppIoProvider>
      <RootErrorBoundary>
        <AppProviders>
          <AppStack />
        </AppProviders>
      </RootErrorBoundary>
    </AppIoProvider>
  );
}

// Wrap always; Sentry.init runs after client_config sync (see AppObservabilityFromClientConfig).
export default Sentry.wrap(RootLayout);
