import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { assert } from '@/@shared/assert';
import { BrowserCrashHandler } from '@/@shared/assert/crash/crash-handler/crash-handler-browser';
import { ExpoCrashHandler } from '@/@shared/assert/crash/crash-handler/crash-handler-expo';
import { ConfigContainerProvider } from '@/@shared/config/config-container';
import { polyfill } from '@/@shared/polyfill';
import { ThemeProvider as AppThemeProvider } from '@/@shared/theme';
import { PatchBootstrap } from '@/ui/patch-bootstrap';
import { useColorScheme } from '../ui/use-color-scheme';

assert.registerCrashHandler(new BrowserCrashHandler());
assert.registerCrashHandler(new ExpoCrashHandler());

polyfill();

assert.notThrows(
  () => crypto.randomUUID(),
  'crypto.randomUUID must be available'
);

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
