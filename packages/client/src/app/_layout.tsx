import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from '@expo-google-fonts/nunito';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/features/auth/auth-context';
import { PrincipalAuthShell } from '@/features/auth/principal-auth-shell';
import { PatchBootstrap } from '@/ui/patch-bootstrap';
import { assert } from '@gamezilla/shared/assert';
import { BrowserCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-browser';
import { ExpoCrashHandler } from '@gamezilla/shared/assert/crash/crash-handler/crash-handler-expo';
import { ConfigContainerProvider } from '@gamezilla/shared/config/config-container';
import { polyfill } from '@gamezilla/shared/polyfill';
import {
  AppThemeRoot,
  hideSplash,
  preventSplashAutoHide,
  useStackProps,
  type FontStacks,
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

  return (
    <AppThemeRoot
      storage={AsyncStorage}
      {...(fontsLoaded ? { fonts: nunitoFontStacks } : {})}
    >
      <ConfigContainerProvider>
        <PrincipalAuthShell>
          <PatchBootstrap>
            <AuthProvider>
              <AppStack />
            </AuthProvider>
          </PatchBootstrap>
        </PrincipalAuthShell>
      </ConfigContainerProvider>
    </AppThemeRoot>
  );
}
