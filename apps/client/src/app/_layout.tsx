import { SpaceMiniplayer } from '@gamezilla/spaces/client/space-miniplayer';
import { AppProviders } from '@gamezilla/client/ui/app-providers';
import { Box, useStackProps } from '@gamezilla/lib/ui';
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
      <Box sx={{ flex: 1, flexDirection: 'column' }}>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <AppStack />
        </Box>
        <SpaceMiniplayer />
      </Box>
    </AppProviders>
  );
}
