/**
 * Splash screen lifecycle helpers (wraps Expo APIs with stable names).
 */

import * as ExpoSplashScreen from 'expo-splash-screen';

export function preventSplashAutoHide(): Promise<boolean> {
  return ExpoSplashScreen.preventAutoHideAsync();
}

export function hideSplash(): Promise<void> {
  return ExpoSplashScreen.hideAsync();
}
