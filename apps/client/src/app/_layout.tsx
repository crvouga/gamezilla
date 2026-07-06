import { isClientSentryEnabled } from '@pkgs/observability/impl-sentry/init-client-sentry';
import { AppProviders } from '@apps/client/providers/app-providers';
import { RootErrorBoundary } from '@apps/client/providers/root-error-boundary';
import { SpaceMiniplayer } from '@libs/spaces/client/miniplayer/space-miniplayer';
import { Box, useStackProps } from '@pkgs/ui';
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
      <Stack.Screen name="todos" />
      <Stack.Screen name="ui" />
      <Stack.Screen
        name="modal"
        options={{
          presentation: 'modal',
        }}
      />
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
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'b580fa',
    },
    body: JSON.stringify({
      sessionId: 'b580fa',
      location: '_layout.tsx:RootLayout:render',
      message: 'RootLayout render',
      hypothesisId: 'H8',
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return (
    <RootErrorBoundary>
      <AppProviders>
        <Box sx={{ flex: 1, minHeight: 0 }} style={{ position: 'relative' }}>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <AppStack />
          </Box>
          <SpaceMiniplayer slot={'root' as const} />
        </Box>
      </AppProviders>
    </RootErrorBoundary>
  );
}

export default isClientSentryEnabled() ? Sentry.wrap(RootLayout) : RootLayout;
