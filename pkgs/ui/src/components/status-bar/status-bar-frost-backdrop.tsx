/**
 * Frosted backdrop for the status overlay. Uses expo-blur when the native
 * view is linked (and on web); otherwise a translucent tint so a stale
 * Expo Dev Client does not red-box on missing ExpoBlurView.
 */

import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, UIManager, View } from 'react-native';

import type { ColorScheme } from '../../theme';

/** Medium Control Center–style frost (1–100). */
const BLUR_INTENSITY = 55;

const GLASS_TINT = {
  light: 'hsla(0, 0%, 100%, 0.55)',
  dark: 'hsla(240, 5%, 13%, 0.55)',
} as const;

/** Stronger wash when native blur is missing so the panel still reads. */
const GLASS_TINT_FALLBACK = {
  light: 'hsla(0, 0%, 100%, 0.82)',
  dark: 'hsla(240, 5%, 13%, 0.82)',
} as const;

function isExpoBlurViewAvailable(): boolean {
  if (Platform.OS === 'web') return true;
  try {
    return UIManager.getViewManagerConfig('ExpoBlurView') != null;
  } catch {
    return false;
  }
}

export type StatusBarFrostBackdropProps = {
  colorScheme: ColorScheme;
};

export function StatusBarFrostBackdrop({
  colorScheme,
}: StatusBarFrostBackdropProps): ReactNode {
  const blurOk = isExpoBlurViewAvailable();

  if (!blurOk) {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.frost,
          { backgroundColor: GLASS_TINT_FALLBACK[colorScheme] },
        ]}
      />
    );
  }

  return (
    <>
      <BlurView
        pointerEvents="none"
        intensity={BLUR_INTENSITY}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        {...(Platform.OS === 'android'
          ? { blurMethod: 'dimezisBlurView' as const }
          : {})}
        style={styles.frost}
      />
      <View
        pointerEvents="none"
        style={[styles.frost, { backgroundColor: GLASS_TINT[colorScheme] }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  frost: {
    ...StyleSheet.absoluteFillObject,
  },
});
