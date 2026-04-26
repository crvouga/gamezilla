import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from '@expo-google-fonts/nunito';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '@gamezilla/client/auth/auth-context';
import { PrincipalAuthShell } from '@gamezilla/client/auth/principal-auth-shell';
import { PwaUpdatePromptBanner } from '@gamezilla/client/pwa/update-prompt';
import { AppCommands } from '@gamezilla/client/ui/app-commands';
import { CommandPaletteNativeGesture } from '@gamezilla/client/ui/command-palette-native-gesture';
import { PatchBootstrap } from '@gamezilla/client/ui/patch-bootstrap';
import { ConfigContainerProvider } from '@gamezilla/domain/config/config-container';
import {
  AppThemeRoot,
  CommandPalette,
  CommandRegistryProvider,
  hideSplash,
  preventSplashAutoHide,
  type FontStacks,
} from '@gamezilla/lib/ui';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

void preventSplashAutoHide();

const nunitoFontStacks: Partial<FontStacks> = {
  sans: 'Nunito_400Regular',
  sansSemibold: 'Nunito_600SemiBold',
  rounded: 'Nunito_700Bold',
};

export function AppProviders({ children }: { children: ReactNode }) {
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
                        {children}
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
