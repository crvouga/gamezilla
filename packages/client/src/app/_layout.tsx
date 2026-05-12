import { AppProviders } from '@gamezilla/client/providers/app-providers';
import { SpaceMiniplayer } from '@gamezilla/spaces/client/miniplayer/space-miniplayer';
import { Box, useStackProps } from '@gamezilla/ui';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

import '@gamezilla/client/polyfill-entry';

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

export default function RootLayout() {
  return (
    <AppProviders>
      <Box sx={{ flex: 1, flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <AppStack />
        </Box>
        <SpaceMiniplayer />
      </Box>
    </AppProviders>
  );
}
