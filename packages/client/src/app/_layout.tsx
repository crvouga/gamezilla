import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/features/auth/auth-context';
import {
  ThemePreferenceProvider,
  useThemePreference,
} from '@/features/theme/theme-preference-context';
import { PatchBootstrap } from '@/ui/patch-bootstrap';
import { assert } from '@gamezilla/shared/assert';
import { BrowserCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-browser';
import { ExpoCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-expo';
import { ConfigContainerProvider } from '@gamezilla/shared/config/config-container';
import { polyfill } from '@gamezilla/shared/polyfill';
import {
  ThemeProvider as AppThemeProvider,
  useTheme,
  type FontStacks,
} from '@gamezilla/shared/theme';
import {
  AppStatusBar,
  hideSplash,
  preventSplashAutoHide,
  reactNavigationThemeFromTokens,
} from '@gamezilla/shared/ui';

assert.registerCrashHandler(new BrowserCrashHandler());
assert.registerCrashHandler(new ExpoCrashHandler());

polyfill();

assert.notThrows(
  () => globalThis.crypto.randomUUID(),
  'crypto.randomUUID must be available'
);

void preventSplashAutoHide();

const nunitoFontStacks: Partial<FontStacks> = {
  sans: 'Nunito_400Regular',
  sansSemibold: 'Nunito_600SemiBold',
  rounded: 'Nunito_700Bold',
};

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppThemeShell({
  children,
  fonts,
}: {
  children: ReactNode;
  fonts?: Partial<FontStacks>;
}) {
  const { preference } = useThemePreference();
  return (
    <AppThemeProvider
      colorScheme={preference}
      systemFallback="light"
      {...(fonts !== undefined ? { fonts } : {})}
    >
      {children}
    </AppThemeProvider>
  );
}

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
          <Stack screenOptions={{ headerShown: false }}>
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
          <AppStatusBar />
        </PatchBootstrap>
      </ConfigContainerProvider>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError !== null) {
      void hideSplash();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && fontError === null) {
    return null;
  }

  return (
    <ThemePreferenceProvider>
      <AppThemeShell
        {...(fontsLoaded ? { fonts: nunitoFontStacks } : {})}
      >
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
      </AppThemeShell>
    </ThemePreferenceProvider>
  );
}
