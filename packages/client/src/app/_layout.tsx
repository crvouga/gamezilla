import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { PatchBootstrap } from '@/ui/patch-bootstrap';
import { assert } from '@gamezilla/shared/assert';
import { BrowserCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-browser';
import { ExpoCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-expo';
import { ConfigContainerProvider } from '@gamezilla/shared/config/config-container';
import { polyfill } from '@gamezilla/shared/polyfill';
import {
  ThemeProvider as AppThemeProvider,
  useTheme,
} from '@gamezilla/shared/theme';
import {
  AppStatusBar,
  preventSplashAutoHide,
  reactNavigationThemeFromTokens,
} from '@gamezilla/shared/ui';

assert.registerCrashHandler(new BrowserCrashHandler());
assert.registerCrashHandler(new ExpoCrashHandler());

polyfill();

assert.notThrows(
  () => crypto.randomUUID(),
  'crypto.randomUUID must be available'
);

void preventSplashAutoHide();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigation() {
  const theme = useTheme();
  const navigationTheme = reactNavigationThemeFromTokens(
    theme.colorScheme,
    theme.colors
  );

  return (
    <NavThemeProvider value={navigationTheme}>
      <ConfigContainerProvider>
        <PatchBootstrap>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="todos" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack>
          <AppStatusBar />
        </PatchBootstrap>
      </ConfigContainerProvider>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider colorScheme="system" systemFallback="light">
      <RootNavigation />
    </AppThemeProvider>
  );
}
