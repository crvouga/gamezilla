import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ConfigContainerProvider } from '@/@shared/config/config-container';
import { ThemeProvider as AppThemeProvider } from '@/@shared/theme';
import { PatchBootstrap } from '@/components/patch-bootstrap';
import { useColorScheme } from '../hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? 'light';

  return (
    <AppThemeProvider colorScheme={scheme}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <ConfigContainerProvider>
          <PatchBootstrap>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="todos" options={{ headerShown: false }} />
              <Stack.Screen
                name="modal"
                options={{ presentation: 'modal', title: 'Modal' }}
              />
            </Stack>
            <StatusBar style="auto" />
          </PatchBootstrap>
        </ConfigContainerProvider>
      </ThemeProvider>
    </AppThemeProvider>
  );
}
