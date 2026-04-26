import { AppProviders } from '@gamezilla/client/ui/app-providers';
import { useStackProps } from '@gamezilla/lib/ui';
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
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <AppStack />
    </AppProviders>
  );
}
