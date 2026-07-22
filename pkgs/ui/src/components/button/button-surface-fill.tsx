/**
 * Absolute-fill vertical gradient behind button / FAB content.
 */

import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

export type ButtonSurfaceFillProps = {
  top: string;
  bottom: string;
  borderRadius: number;
};

export function ButtonSurfaceFill({
  top,
  bottom,
  borderRadius,
}: ButtonSurfaceFillProps): ReactNode {
  return (
    <LinearGradient
      colors={[top, bottom]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { borderRadius }]}
    />
  );
}
