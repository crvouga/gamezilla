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

import { AuthProvider } from '@gamezilla/client/auth/auth-context';
import { PrincipalAuthShell } from '@gamezilla/client/auth/principal-auth-shell';
import { PwaUpdatePromptBanner } from '@gamezilla/client/pwa/update-prompt';
import { AppCommands } from '@gamezilla/client/ui/app-commands';
import { CommandPaletteNativeGesture } from '@gamezilla/client/ui/command-palette-native-gesture';
import { PatchBootstrap } from '@gamezilla/client/ui/patch-bootstrap';
import { ConfigContainerProvider } from '@gamezilla/domain/config/config-container';
import { assert } from '@gamezilla/lib/assert';
import { BrowserCrashHandler } from '@gamezilla/lib/assert/crash/crash-handler/crash-handler-browser';
import { ExpoCrashHandler } from '@gamezilla/lib/assert/crash/crash-handler/crash-handler-expo';
import { polyfill } from '@gamezilla/lib/polyfill';
import {
  AppThemeRoot,
  CommandPalette,
  CommandRegistryProvider,
  hideSplash,
  preventSplashAutoHide,
  useStackProps,
  type FontStacks,
} from '@gamezilla/lib/ui';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

assert.registerCrashHandler(new BrowserCrashHandler());
assert.registerCrashHandler(new ExpoCrashHandler());

polyfill();

assert.ok(
  typeof globalThis.crypto !== 'undefined',
  'globalThis.crypto must exist after polyfill'
);
assert.ok(
  typeof globalThis.crypto.getRandomValues === 'function',
  'crypto.getRandomValues must be a function'
);
assert.notThrows(
  () => globalThis.crypto.getRandomValues(new Uint8Array(16)),
  'crypto.getRandomValues must accept Uint8Array'
);
assert.notThrows(
  () => globalThis.crypto.randomUUID(),
  'crypto.randomUUID must be available'
);
assert.ok(typeof Buffer !== 'undefined', 'Buffer must exist for peer-store');
assert.notThrows(
  () => {
    const u = new Uint8Array([0xab, 0xcd, 0x3c, 0x3e]);
    const b64 = Buffer.from(u).toString('base64');
    const back = Buffer.from(b64, 'base64');
    assert.ok(
      back.length === u.length && back.every((b, i) => b === u[i]),
      'Buffer base64 round-trip'
    );
  },
  'Buffer base64 must work for peer-store (polyfill has no base64url encoding)'
);
assert.ok(
  typeof TextEncoder === 'function',
  'TextEncoder must exist for peer-store crypto'
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
    <GestureHandlerRootView style={{ flex: 1 }} testID="app-root">
      <SafeAreaProvider>
        <AppThemeRoot
          storage={AsyncStorage}
          {...(fontsLoaded ? { fonts: nunitoFontStacks } : {})}
        >
          <BottomSheetModalProvider>
            <ConfigContainerProvider>
              <PrincipalAuthShell>
                <PatchBootstrap>
                  <AuthProvider>
                    <CommandRegistryProvider storage={AsyncStorage}>
                      <AppCommands />
                      <CommandPalette />
                      <CommandPaletteNativeGesture>
                        {Platform.OS === 'web' ? (
                          <PwaUpdatePromptBanner />
                        ) : null}
                        <AppStack />
                      </CommandPaletteNativeGesture>
                    </CommandRegistryProvider>
                  </AuthProvider>
                </PatchBootstrap>
              </PrincipalAuthShell>
            </ConfigContainerProvider>
          </BottomSheetModalProvider>
        </AppThemeRoot>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
