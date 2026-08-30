/**
 * Keep modal chrome mounted while `visible` is true.
 * Nuclear overhaul: no exit fade — mount/unmount is instant.
 *
 * Opacity stays at 1; do not call Animated.Value.setValue during render
 * (React 19 forbids updating Animated(View) while rendering ModalRoot).
 */

import { useRef } from 'react';
import { Animated } from 'react-native';

export type ModalPresence = {
  /** True while the surface should stay registered. */
  mounted: boolean;
  opacity: Animated.Value;
};

export function useModalPresence(visible: boolean): ModalPresence {
  const opacity = useRef(new Animated.Value(1)).current;
  return { mounted: visible, opacity };
}
